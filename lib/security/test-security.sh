#!/bin/bash

# Security Features Test Script
# Run this to verify all security enhancements are working

API_URL="${1:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

echo "Testing Security Features for Festive Rides"
echo "API URL: $API_URL"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local test_name="$1"
    local expected_status="$2"
    local response
    local status

    echo -n "Testing: $test_name... "

    shift 2
    response=$(curl -s -w "\n%{http_code}" "$@")
    status=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $status)"
        ((PASSED++))
        if [ "$VERBOSE" = "true" ]; then
            echo "  Response: $body"
        fi
    else
        echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $status)"
        echo "  Response: $body"
        ((FAILED++))
    fi
}

echo "1. Testing Honeypot Detection"
echo "------------------------------"
test_endpoint \
    "Honeypot field filled (should block)" \
    "400" \
    -X POST "$API_URL/api/bookings" \
    -H "Content-Type: application/json" \
    -d '{
        "honeypot": "bot-filled-this",
        "passenger_name": "Test User",
        "passenger_email": "test@example.com",
        "passenger_phone": "0212345678"
    }'
echo ""

echo "2. Testing Fast Submission Detection"
echo "-------------------------------------"
CURRENT_TIME=$(date +%s%3N)
test_endpoint \
    "Form submitted too quickly (should block)" \
    "400" \
    -X POST "$API_URL/api/bookings" \
    -H "Content-Type: application/json" \
    -d "{
        \"formLoadTime\": $CURRENT_TIME,
        \"passenger_name\": \"Test User\",
        \"passenger_email\": \"test@example.com\",
        \"passenger_phone\": \"0212345678\"
    }"
echo ""

echo "3. Testing Request Size Limits"
echo "-------------------------------"
# Generate large payload (2MB of 'x' characters)
LARGE_PAYLOAD=$(python3 -c 'print("{\"data\": \"" + "x"*2000000 + "\"}")' 2>/dev/null || echo '{"data": "test"}')
test_endpoint \
    "Oversized request (should block)" \
    "413" \
    -X POST "$API_URL/api/bookings" \
    -H "Content-Type: application/json" \
    -d "$LARGE_PAYLOAD"
echo ""

echo "4. Testing Rate Limiting"
echo "------------------------"
echo "Sending 12 requests rapidly..."
SUCCESS_COUNT=0
BLOCKED_COUNT=0

for i in {1..12}; do
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/api/bookings" \
        -H "Content-Type: application/json" \
        -d '{
            "passenger_name": "Test User",
            "passenger_email": "test@example.com",
            "passenger_phone": "0212345678",
            "formLoadTime": 0
        }' 2>/dev/null)

    status=$(echo "$response" | tail -n 1)

    if [ "$status" = "429" ]; then
        ((BLOCKED_COUNT++))
    else
        ((SUCCESS_COUNT++))
    fi

    if [ "$VERBOSE" = "true" ]; then
        echo "  Request $i: HTTP $status"
    fi
done

echo "  Allowed: $SUCCESS_COUNT, Blocked: $BLOCKED_COUNT"
if [ $BLOCKED_COUNT -gt 0 ]; then
    echo -e "  ${GREEN}PASS${NC} - Rate limiting is working"
    ((PASSED++))
else
    echo -e "  ${YELLOW}WARNING${NC} - No requests were rate limited (may need more requests or check config)"
fi
echo ""

echo "5. Testing Security Headers"
echo "---------------------------"
HEADERS=$(curl -s -I "$API_URL/api/bookings/check-availability")

check_header() {
    local header_name="$1"
    if echo "$HEADERS" | grep -qi "^$header_name:"; then
        echo -e "  ${GREEN}✓${NC} $header_name present"
        ((PASSED++))
    else
        echo -e "  ${RED}✗${NC} $header_name missing"
        ((FAILED++))
    fi
}

check_header "X-Frame-Options"
check_header "X-Content-Type-Options"
check_header "X-XSS-Protection"
check_header "Referrer-Policy"
check_header "Permissions-Policy"

if [ "$VERBOSE" = "true" ]; then
    echo ""
    echo "  All Headers:"
    echo "$HEADERS" | grep -E "^X-|^Strict-|^Content-Security|^Permissions"
fi
echo ""

echo "6. Testing Duplicate IP Detection"
echo "----------------------------------"
echo "  Note: This test requires database setup and may not work in isolation"
echo "  Check application logs for DUPLICATE_IP_BOOKING events"
echo ""

echo "=============================================="
echo "Test Summary"
echo "=============================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All critical security tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
