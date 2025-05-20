import { NextResponse } from "next/server";
import { listWasabiBuckets } from "@/lib/wasabi-minimal";

export async function GET() {
  console.log("--- /api/wasabi-test called ---");
  const result = await listWasabiBuckets();
  console.log("--- /api/wasabi-test result ---", result);
  return NextResponse.json(result);
} 