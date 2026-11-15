"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/line-chart";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

const chartData = [
  { month: "January", desktop: 186, mobile: 87 },
  { month: "February", desktop: 305, mobile: 163 },
  { month: "March", desktop: 237, mobile: 142 },
  { month: "April", desktop: 73, mobile: 195 },
  { month: "May", desktop: 209, mobile: 118 },
  { month: "June", desktop: 214, mobile: 231 },
];

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "#0ea5e9",
  },
  mobile: {
    label: "Mobile",
    color: "#38bdf8",
  },
} satisfies ChartConfig;

export default function GlowingLineChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Glowing Line Chart</span>
          <Badge
            variant="outline"
            className="text-emerald-500 bg-emerald-500/10 border-none ml-2 font-bold"
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            <span>5.2%</span>
          </Badge>
        </CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="desktop"
              type="bump"
              stroke="#0ea5e9"
              dot={false}
              strokeWidth={3}
              filter="url(#rainbow-line-glow)"
            />
            <Line
              dataKey="mobile"
              type="bump"
              stroke="#38bdf8"
              dot={false}
              strokeWidth={3}
              filter="url(#rainbow-line-glow)"
            />
            <defs>
              <filter
                id="rainbow-line-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
export { GlowingLineChart };
