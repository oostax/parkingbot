import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/options";

export async function GET(
  request: NextRequest,
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    const count = await prisma.favorites.count({
      where: { user_id: userId }
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error(`Error counting favorites: ${error}`);
    return NextResponse.json(
      { error: "Failed to count favorites" },
      { status: 500 }
    );
  }
} 