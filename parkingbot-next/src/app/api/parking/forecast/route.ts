import { NextRequest, NextResponse } from 'next/server';
import { getParkingForecast } from '@/db/utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Parking ID is required' },
      { status: 400 }
    );
  }

  try {
    const forecast = await getParkingForecast(id);
    return NextResponse.json(forecast);
  } catch (error) {
    console.error(`Error getting forecast for parking ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch forecast data' },
      { status: 500 }
    );
  }
} 