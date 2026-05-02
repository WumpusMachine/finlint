import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Claude analysis will be wired here
    return NextResponse.json({ message: "Analysis endpoint ready", code });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
