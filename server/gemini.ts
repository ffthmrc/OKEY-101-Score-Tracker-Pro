// Gemini analizi sunucuda çalışır; API anahtarı sadece GEMINI_API_KEY ortam değişkenindedir.
import { GoogleGenAI } from '@google/genai';
import type { Player, RoundScore } from '../types.ts';
import { totalOf } from '../shared/game.ts';

const FALLBACK = 'The AI referee is currently reviewing the play tapes. Check back in a moment!';

export const getGameAnalysis = async (players: Player[], rounds: RoundScore[]): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK;

  const stats = players
    .map(p => ({ name: p.name, totalScore: totalOf(rounds, p.id) }))
    .sort((a, b) => a.totalScore - b.totalScore)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const prompt = `
    Analyze this game leaderboard. Lower scores are better.

    Players: ${players.map(p => p.name).join(', ')}
    Current Rankings (Lower is better):
    ${stats.map(s => `${s.name}: Total ${s.totalScore}, Rank ${s.rank}`).join('\n')}

    Round History Data:
    ${JSON.stringify(rounds)}

    Please provide:
    1. A witty and brief summary of the current standings.
    2. A shoutout to the current leader (the one with the lowest score).
    3. A playful roast for the player in last place (the '💩' rank).
    4. A strategic insight based on round performance trends.

    Keep the tone fun, competitive, and sports-commentary style.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text ?? FALLBACK;
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    return FALLBACK;
  }
};
