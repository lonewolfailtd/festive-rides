import SmoothScroll from "../SmoothScroll";
import TestScene from "./TestScene";

export const metadata = { title: "Motion test", robots: { index: false, follow: false } };

export default function TestPage() {
  return (
    <SmoothScroll>
      <TestScene />
    </SmoothScroll>
  );
}
