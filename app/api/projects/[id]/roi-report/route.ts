import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { supabase } from "@/lib/db";
import { periodRange, periodDescription, type PeriodKey } from "@/lib/roi";

// Headless Chromium needs the Node runtime and a generous timeout (cold-start +
// page render + PDF). The report itself is a normal in-app route at
// /report/roi/[id], so it also works as an on-screen preview / print fallback.
export const runtime = "nodejs";
export const maxDuration = 60;

const PERIODS: PeriodKey[] = ["30d", "month", "90d", "all"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const periodParam = req.nextUrl.searchParams.get("period") ?? "all";
  const period: PeriodKey = PERIODS.includes(periodParam as PeriodKey) ? (periodParam as PeriodKey) : "all";

  // Validate the client has a rate set (otherwise the report has nothing to show).
  const { data: project } = await supabase
    .from("projects")
    .select("client_name, value_per_1k_views")
    .eq("id", id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.value_per_1k_views === null || project.value_per_1k_views === undefined) {
    return NextResponse.json({ error: "Set a value-per-1,000-views rate on the client profile first." }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const reportUrl = `${origin}/report/roi/${id}?period=${period}`;

  let browser;
  try {
    browser = process.env.VERCEL
      ? await puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          defaultViewport: { width: 820, height: 1200 },
          headless: true,
        })
      : await puppeteer.launch({
          channel: "chrome",
          defaultViewport: { width: 820, height: 1200 },
          headless: true,
        });

    const page = await browser.newPage();
    // Authenticate the headless browser past middleware.ts (shared-secret cookie).
    await page.setCookie({ name: "tf_auth", value: process.env.APP_SECRET ?? "", url: origin });

    await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 45_000 });
    await page.waitForSelector("[data-report-ready]", { timeout: 15_000 }).catch(() => {});

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const periodSlug = periodDescription(period, periodRange(period))
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    const clientSlug = (project.client_name || "client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const filename = `ROI-${clientSlug}-${periodSlug}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
