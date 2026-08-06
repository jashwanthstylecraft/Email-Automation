'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface ChartProps {
  data: any;
}

const CATEGORY_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];
const SENTIMENT_COLORS = {
  POSITIVE: '#22c55e',
  NEUTRAL: '#a1a1aa',
  NEGATIVE: '#f59e0b',
  ANGRY: '#ef4444'
};

export function EmailsPerDayChart({ data }: ChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !data) return <div className="h-64 flex items-center justify-center text-text-muted">Loading charts...</div>;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="day" stroke="#a1a1aa" fontSize={11} tickLine={false} />
          <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f0f12', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
            labelStyle={{ color: '#f4f4f5', fontSize: '11px', fontWeight: 'bold' }}
            itemStyle={{ fontSize: '11px' }}
          />
          <Bar dataKey="emails" name="Received" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="autoReplies" name="Auto Replied" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoriesChart({ data }: ChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !data) return <div className="h-64 flex items-center justify-center text-text-muted">Loading charts...</div>;

  return (
    <div className="h-72 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0f0f12', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
            itemStyle={{ fontSize: '11px', color: '#f4f4f5' }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-[11px] text-text-secondary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SentimentChart({ data }: ChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !data) return <div className="h-64 flex items-center justify-center text-text-muted">Loading charts...</div>;

  return (
    <div className="h-72 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
          >
            {data.map((entry: any, index: number) => {
              const color = (SENTIMENT_COLORS as any)[entry.name] || '#6366f1';
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0f0f12', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
            itemStyle={{ fontSize: '11px', color: '#f4f4f5' }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-[11px] text-text-secondary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
