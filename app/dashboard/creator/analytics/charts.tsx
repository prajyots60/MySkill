"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import * as d3 from "d3"

interface ChartData {
  [key: string]: any
}

interface LineChartProps {
  data: ChartData[]
  xKey: string
  yKey: string
  color: string
}

interface BarChartProps {
  data: ChartData[]
  xKey: string
  yKey: string
  color: string
}

interface PieChartProps {
  data: ChartData[]
  nameKey: string
  valueKey: string
}

export function LineChart({ data, xKey, yKey, color }: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  useEffect(() => {
    if (!svgRef.current || !data.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const width = svgRef.current.clientWidth - margin.left - margin.right
    const height = svgRef.current.clientHeight - margin.top - margin.bottom

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // X scale
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d[xKey]))
      .range([0, width])
      .padding(0.1)

    // Y scale
    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (d) => d[yKey]) as number) * 1.1])
      .nice()
      .range([height, 0])

    // Line generator
    const line = d3
      .line<ChartData>()
      .x((d) => (x(d[xKey]) as number) + x.bandwidth() / 2)
      .y((d) => y(d[yKey]))
      .curve(d3.curveMonotoneX)

    // Add the line path
    g.append("path").datum(data).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("d", line)

    // Add dots
    g.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => (x(d[xKey]) as number) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d[yKey]))
      .attr("r", 4)
      .attr("fill", color)

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("fill", isDark ? "#9ca3af" : "#6b7280")
      .style("text-anchor", "middle")

    // Add Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `${d}`),
      )
      .selectAll("text")
      .attr("fill", isDark ? "#9ca3af" : "#6b7280")

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(() => ""),
      )
      .selectAll("line")
      .attr("stroke", isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")

    // Add area under the line
    g.append("path")
      .datum(data)
      .attr("fill", `${color}20`)
      .attr(
        "d",
        d3
          .area<ChartData>()
          .x((d) => (x(d[xKey]) as number) + x.bandwidth() / 2)
          .y0(height)
          .y1((d) => y(d[yKey]))
          .curve(d3.curveMonotoneX),
      )
  }, [data, xKey, yKey, color, isDark])

  return <svg ref={svgRef} width="100%" height="100%"></svg>
}

interface BarChartProps {
  data: ChartData[]
  xKey: string
  yKey: string
  color: string
  onBarClick?: (index: number) => void
}

export function BarChart({ data, xKey, yKey, color, onBarClick }: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  useEffect(() => {
    if (!svgRef.current || !data.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 60, left: 50 }
    const width = svgRef.current.clientWidth - margin.left - margin.right
    const height = svgRef.current.clientHeight - margin.top - margin.bottom

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // X scale
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d[xKey]))
      .range([0, width])
      .padding(0.3)

    // Y scale
    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (d) => d[yKey]) as number) * 1.1])
      .nice()
      .range([height, 0])

    // Add bars
    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d[xKey]) as number)
      .attr("y", (d) => y(d[yKey]))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d[yKey]))
      .attr("fill", color)
      .attr("rx", 4)
      .attr("ry", 4)
      .style("cursor", onBarClick ? "pointer" : "default")
      .on("click", (event, d) => {
        if (onBarClick) {
          // Find the index of the clicked bar
          const index = data.findIndex(item => item === d);
          onBarClick(index);
        }
      })

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("fill", isDark ? "#9ca3af" : "#6b7280")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")

    // Add Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `${d}`),
      )
      .selectAll("text")
      .attr("fill", isDark ? "#9ca3af" : "#6b7280")

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-width)
          .tickFormat(() => ""),
      )
      .selectAll("line")
      .attr("stroke", isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")

    // Add value labels on top of bars
    g.selectAll(".label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", (d) => (x(d[xKey]) as number) + x.bandwidth() / 2)
      .attr("y", (d) => y(d[yKey]) - 5)
      .attr("text-anchor", "middle")
      .attr("fill", isDark ? "#9ca3af" : "#6b7280")
      .attr("font-size", "10px")
      .text((d) => d[yKey])
  }, [data, xKey, yKey, color, isDark])

  return <svg ref={svgRef} width="100%" height="100%"></svg>
}

export function PieChart({ data, nameKey, valueKey }: PieChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  useEffect(() => {
    if (!svgRef.current || !data.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const radius = (Math.min(width, height) / 2) * 0.8

    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`)

    // Color scale
    const color = d3
      .scaleOrdinal()
      .domain(data.map((d) => d[nameKey]))
      .range(d3.schemeCategory10)

    // Pie generator
    const pie = d3
      .pie<ChartData>()
      .value((d) => d[valueKey])
      .sort(null)

    // Arc generator
    const arc = d3.arc<d3.PieArcDatum<ChartData>>().innerRadius(0).outerRadius(radius)

    // Label arc generator
    const labelArc = d3
      .arc<d3.PieArcDatum<ChartData>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.6)

    // Add arcs
    const arcs = g.selectAll(".arc").data(pie(data)).enter().append("g").attr("class", "arc")

    // Add path
    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => color(d.data[nameKey]) as string)
      .attr("stroke", isDark ? "#1f2937" : "#ffffff")
      .attr("stroke-width", 2)

    // Add labels
    arcs
      .append("text")
      .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", isDark ? "#e5e7eb" : "#374151")
      .text((d) => `${d.data[nameKey]} (${d.data[valueKey]}%)`)

    // Add legend
    const legend = svg.append("g").attr("transform", `translate(${width - 100},20)`)

    legend
      .selectAll(".legend-item")
      .data(data)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (_, i) => `translate(0,${i * 20})`)
      .each(function (d) {
        d3.select(this)
          .append("rect")
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", color(d[nameKey]) as string)

        d3.select(this)
          .append("text")
          .attr("x", 20)
          .attr("y", 10)
          .attr("font-size", "10px")
          .attr("fill", isDark ? "#e5e7eb" : "#374151")
          .text(d[nameKey])
      })
  }, [data, nameKey, valueKey, isDark])

  return <svg ref={svgRef} width="100%" height="100%"></svg>
}
