import { Player, RoundScore, PlayerStats } from "./types";

/**
 * Analiz sunucuda yapılır (server/gemini.ts); API anahtarı tarayıcıya hiç gelmez.
 * `stats` imza uyumluluğu için duruyor, sunucu sıralamayı kendisi hesaplar.
 */
export const getGameAnalysis = async (
  players: Player[],
  rounds: RoundScore[],
  _stats?: PlayerStats[]
) => {
  try {
    const res = await fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players, rounds }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { text: string };
    return data.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "The AI referee is currently reviewing the play tapes. Check back in a moment!";
  }
};
