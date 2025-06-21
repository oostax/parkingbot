import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Получаем активные челленджи
    const activeChallenges = await prisma.$queryRaw`
      SELECT 
        Challenge.id, 
        Challenge.title, 
        Challenge.description, 
        Challenge.reward, 
        Challenge.startDate, 
        Challenge.endDate, 
        Challenge.type, 
        Challenge.requirement,
        ChallengeCompletion.completedAt as userCompletedAt
      FROM Challenge
      LEFT JOIN ChallengeCompletion ON Challenge.id = ChallengeCompletion.challengeId AND ChallengeCompletion.userId = ${userId}
      WHERE Challenge.isActive = 1
      ORDER BY Challenge.endDate ASC
    `;

    return NextResponse.json({
      challenges: activeChallenges
    });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500 }
    );
  }
} 