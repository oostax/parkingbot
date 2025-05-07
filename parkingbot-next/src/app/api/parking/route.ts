import { NextResponse } from 'next/server';
import { getAllParkings } from '@/db/utils';

export async function GET() {
  try {
    const parkings = await getAllParkings();
    return NextResponse.json(parkings);
  } catch (error) {
    console.error('Error in parking route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parkings' },
      { status: 500 }
    );
  }
} 