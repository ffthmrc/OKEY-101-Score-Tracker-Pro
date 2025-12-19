
import { GoogleGenAI, Type } from "@google/genai";
import { Player, RoundScore, PlayerStats } from "./types";

export const getGameAnalysis = async (
  players: Player[],
  rounds: RoundScore[],
  stats: PlayerStats[]
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "The AI referee is currently reviewing the play tapes. Check back in a moment!";
  }
};
