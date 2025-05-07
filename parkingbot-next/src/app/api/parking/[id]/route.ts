import { NextRequest, NextResponse } from 'next/server';
import { getParkingById } from '@/db/utils';
import { getParkingInfo } from '@/lib/parking-api';

export async function GET(
  request: NextRequest,
) {
  // Получение id из URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    // First try to get fresh data from the API
    const apiData = await getParkingInfo(id);
    
    if (apiData) {
      return NextResponse.json(apiData);
    }
    
    // If API fails, fallback to database
    const dbData = await getParkingById(id);
    
    if (!dbData) {
      return NextResponse.json(
        { error: 'Parking not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(dbData);
  } catch (error) {
    console.error(`Error getting parking ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch parking details' },
      { status: 500 }
    );
  }
} 