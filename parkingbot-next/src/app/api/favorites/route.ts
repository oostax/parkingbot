import { NextRequest, NextResponse } from 'next/server';
import { getUserFavorites, addFavorite, removeFavorite } from '@/db/utils';
import { auth } from '../auth/[...nextauth]/route';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const favorites = await getUserFavorites(session.user.id);
    return NextResponse.json(favorites);
  } catch (error) {
    console.error('Error getting favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { parkingId } = await request.json();

    if (!parkingId) {
      return NextResponse.json(
        { error: 'Parking ID is required' },
        { status: 400 }
      );
    }

    const success = await addFavorite(session.user.id, parkingId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to add favorite' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { parkingId } = await request.json();

    if (!parkingId) {
      return NextResponse.json(
        { error: 'Parking ID is required' },
        { status: 400 }
      );
    }

    const success = await removeFavorite(session.user.id, parkingId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to remove favorite' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json(
      { error: 'Failed to remove favorite' },
      { status: 500 }
    );
  }
} 