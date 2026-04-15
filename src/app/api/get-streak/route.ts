import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { playerTokenABI } from '@/config/contracts'

export async function POST(request: NextRequest) {
  try {
    const { wallet, playerTokenAddr } = await request.json()

    if (!wallet || !playerTokenAddr) {
      return NextResponse.json(
        { error: 'Missing wallet or playerTokenAddr' },
        { status: 400 }
      )
    }

    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL)

    // Create player token contract instance
    const playerToken = new ethers.Contract(
      playerTokenAddr,
      playerTokenABI,
      provider
    )

    // Get streak and total days held
    const [streak, totalDaysHeld] = await Promise.all([
      playerToken.holdStreak(wallet),
      playerToken.totalDaysHeld(wallet)
    ])

    return NextResponse.json({
      streak: Number(streak),
      totalDaysHeld: Number(totalDaysHeld)
    })

  } catch (error: any) {
    console.error('Error getting streak:', error)
    return NextResponse.json(
      { error: 'Failed to get streak data', details: error.message },
      { status: 500 }
    )
  }
}