import { FeedbackType } from '@prisma/client';
import { FEEDBACK_TOPICS, FeedbackAnalysisResult, Level } from './ai.schemas';

type Topic = (typeof FEEDBACK_TOPICS)[number];

/** Multilingual keyword lexicon (Uzbek latin/cyrillic, Russian, English). */
const TOPIC_LEXICON: Record<Topic, RegExp> = {
  waiting_time: /kutd|kutish|kuttir|navbat|uzoq|очеред|ждал|долго|wait|queue|delay/i,
  staff_response: /chaqir|kech kel|kelmadi|javob bermad|не приш|не отвеч|вызыва|no one came|didn['’]?t come|respond/i,
  staff_attitude: /qo['‘’`]?pol|befarq|baqir|хамств|груб|равнодуш|кричал|rude|disrespect|ignored/i,
  cleanliness: /iflos|toza emas|hojatxona|chang|грязн|туалет|антисанитар|dirty|unclean|toilet/i,
  food: /ovqat|taom|еда|питани|кормят|food|meal/i,
  medication: /dori|укол|лекарств|препарат|medic|drug|pill/i,
  cost: /pul|pora|to['‘’`]?lov|narx|взятк|деньг|плат|bribe|money|pay|cost/i,
  communication: /tushuntir|ma['‘’`]?lumot berm|объясн|не сказал|explain|inform/i,
  facilities: /issiq|sovuq|konditsioner|karavot|lift|жарко|холодно|кроват|лифт|bed|heating|air.?condition/i,
  treatment_quality: /davola|tashxis|лечени|диагноз|treatment|diagnos/i,
};

const POSITIVE = /rahmat|minnatdor|yaxshi|zo['‘’`]?r|a['‘’`]?lo|спасибо|благодар|хорош|отличн|thank|great|excellent|good|kind/i;
const NEGATIVE = /yomon|afsus|norozi|shikoyat|плох|ужасн|недовол|жалоб|bad|terrible|awful|complain|never again/i;
const SAFETY = /xato dori|noto['‘’`]?g['‘’`]?ri dori|o['‘’`]?lim|o['‘’`]?ldi|zaharlan|неправильн.{0,10}лекарств|умер|смерт|отравл|wrong (medication|drug)|died|death|abuse|violence|urish|бил/i;
const CORRUPTION = /pora|взятк|bribe|pul so['‘’`]?ra|деньги требов|asked for money/i;

export function analyzeFeedbackByRules(input: { rating: number; type: FeedbackType; text?: string | null }): FeedbackAnalysisResult {
  const text = input.text ?? '';
  const topics = (Object.keys(TOPIC_LEXICON) as Topic[]).filter((t) => TOPIC_LEXICON[t].test(text)).slice(0, 5);

  let polarity = input.rating >= 4 ? 1 : input.rating <= 2 ? -1 : 0;
  if (POSITIVE.test(text)) polarity += 1;
  if (NEGATIVE.test(text)) polarity -= 1;
  if (input.type === FeedbackType.COMPLAINT) polarity -= 1;
  if (input.type === FeedbackType.PRAISE) polarity += 1;
  const sentiment = polarity > 0 ? 'POSITIVE' : polarity < 0 ? 'NEGATIVE' : 'NEUTRAL';

  const isSafety = SAFETY.test(text);
  const isCorruption = CORRUPTION.test(text);

  let category: FeedbackAnalysisResult['category'] = 'other';
  if (isCorruption) category = 'corruption';
  else if (isSafety) category = 'clinical_safety';
  else if (sentiment === 'POSITIVE' && input.type !== FeedbackType.COMPLAINT) category = 'praise';
  else if (topics.includes('staff_attitude')) category = 'staff_behavior';
  else if (topics.includes('cleanliness')) category = 'cleanliness';
  else if (topics.includes('facilities') || topics.includes('food')) category = 'infrastructure';
  else if (topics.length > 0 || sentiment === 'NEGATIVE') category = 'service_quality';

  let priority: Level = 'LOW';
  if (isSafety || isCorruption) priority = 'HIGH';
  else if (sentiment === 'NEGATIVE') priority = input.rating <= 1 ? 'HIGH' : 'MEDIUM';

  const summary =
    topics.length > 0
      ? `${sentiment.toLowerCase()} feedback about ${topics.map((t) => t.replace(/_/g, ' ')).join(', ')}`
      : `${sentiment.toLowerCase()} feedback (rating ${input.rating}/5)`;

  return { sentiment, category, topics, priority, summary };
}
