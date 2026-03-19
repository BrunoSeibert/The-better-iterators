export const BADGES = [
  { emoji: '🎖️', label: 'First Step',  description: 'Join StudyOn',           condition: (_streak: number, level: number) => level >= 1 },
  { emoji: '🔥', label: 'On Fire',     description: 'Reach a 3-day streak',    condition: (streak: number) => streak >= 3 },
  { emoji: '🎓', label: 'Scholar',     description: 'Reach level 3',           condition: (_streak: number, level: number) => level >= 3 },
  { emoji: '🚀', label: 'Rocket',      description: 'Reach level 5',           condition: (_streak: number, level: number) => level >= 4 },
  { emoji: '💡', label: 'Innovator',   description: 'Reach level 6',           condition: (_streak: number, level: number) => level >= 5 },
  { emoji: '👑', label: 'Champion',    description: 'Complete all 7 levels',   condition: (_streak: number, level: number) => level >= 6 },
];