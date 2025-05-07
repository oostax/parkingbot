'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ParkingStats } from '@/db/utils';

interface ParkingForecastProps {
  parkingId: string;
}

export default function ParkingForecast({ parkingId }: ParkingForecastProps) {
  const [forecastData, setForecastData] = useState<ParkingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/parking/forecast?id=${parkingId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch forecast data');
        }
        
        const data = await response.json();
        setForecastData(data);
      } catch (err) {
        setError('Не удалось загрузить данные прогноза');
        console.error('Error fetching forecast:', err);
      } finally {
        setLoading(false);
      }
    };

    if (parkingId) {
      fetchForecast();
    }
  }, [parkingId]);

  if (loading) {
    return <div className="h-40 flex items-center justify-center">Загрузка прогноза...</div>;
  }

  if (error) {
    return <div className="h-40 flex items-center justify-center text-red-500">{error}</div>;
  }

  // Format data for the chart
  const chartData = forecastData.map(item => ({
    hour: `${item.hour}:00`,
    freeSpaces: Math.round(item.avg_free_spaces),
    occupancyRate: Math.round(item.avg_occupancy * 100)
  }));
  
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-2">Прогноз загруженности по часам</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="hour" 
              tick={{ fontSize: 10 }}
              interval={2}
            />
            <YAxis 
              yAxisId="left"
              orientation="left"
              label={{ value: 'Мест', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10 } }}
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              label={{ value: '%', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 10 } }}
              tick={{ fontSize: 10 }}
            />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'freeSpaces') return [`${value} мест`, 'Свободно'];
                if (name === 'occupancyRate') return [`${value}%`, 'Занято'];
                return [value, name];
              }}
              labelFormatter={(label) => `Время: ${label}`}
            />
            <Bar 
              yAxisId="left"
              dataKey="freeSpaces" 
              fill="#4ade80" 
              name="freeSpaces"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              yAxisId="right"
              dataKey="occupancyRate" 
              fill="#f43f5e" 
              name="occupancyRate"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        * Данные основаны на статистике заполнения парковки
      </p>
    </div>
  );
} 