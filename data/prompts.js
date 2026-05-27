export const LEVELS = [
  {
    id: "curiosity",
    name: "Curiosity",
    number: "Level 1",
    guidance: "Notice what is easy to miss.",
    completion: "You have warmed up the room. Next, trade small observations for real stories."
  },
  {
    id: "connection",
    name: "Connection",
    number: "Level 2",
    guidance: "Answer with a story, not a performance.",
    completion: "You made space for honesty. The final level asks what you want to carry forward."
  },
  {
    id: "reflection",
    name: "Reflection",
    number: "Level 3",
    guidance: "Say what matters while you have the chance.",
    completion: "You reached the end of this deck."
  }
];

const all = ["couple", "friends", "group"];

export const PROMPTS = [
  { id: "c01", level: "curiosity", audiences: all, text: "What detail about today would you probably forget a week from now?" },
  { id: "c02", level: "curiosity", audiences: all, text: "What is something small that reliably changes your mood for the better?" },
  { id: "c03", level: "curiosity", audiences: all, text: "What did you care about deeply when you were ten?" },
  { id: "c04", level: "curiosity", audiences: all, text: "What is a compliment you still remember receiving?" },
  { id: "c05", level: "curiosity", audiences: all, text: "Where do you feel most like yourself?" },
  { id: "c06", level: "curiosity", audiences: all, text: "What song, meal, or smell sends you somewhere instantly?" },
  { id: "c07", level: "curiosity", audiences: all, text: "What is a harmless habit of yours people only discover with time?" },
  { id: "c08", level: "curiosity", audiences: all, text: "What subject could you happily learn more about for no practical reason?" },
  { id: "c09", level: "curiosity", audiences: ["couple", "friends"], text: "What was your first impression of me, and what changed?" },
  { id: "c10", level: "curiosity", audiences: ["group"], text: "Who at this table would you ask for advice about something unexpected?" },
  { id: "c11", level: "curiosity", audiences: all, text: "What version of a perfect quiet afternoon appeals to you?" },
  { id: "c12", level: "curiosity", audiences: all, text: "What is one thing you are looking forward to that feels ordinary but important?" },

  { id: "n01", level: "connection", audiences: all, text: "What is a lesson you learned later than you wish you had?" },
  { id: "n02", level: "connection", audiences: all, text: "When do you find it hardest to ask for help?" },
  { id: "n03", level: "connection", audiences: all, text: "What part of your life feels unfinished in an exciting way?" },
  { id: "n04", level: "connection", audiences: all, text: "What is something you are trying to be kinder to yourself about?" },
  { id: "n05", level: "connection", audiences: all, text: "Tell a story about a time someone made you feel included." },
  { id: "n06", level: "connection", audiences: all, text: "What does feeling safe with another person look like to you?" },
  { id: "n07", level: "connection", audiences: all, text: "What expectation have you recently let go of?" },
  { id: "n08", level: "connection", audiences: all, text: "What truth about yourself has become easier to say out loud?" },
  { id: "n09", level: "connection", audiences: ["couple"], text: "What is one way I support you that I might not realize matters?" },
  { id: "n10", level: "connection", audiences: ["friends"], text: "What kind of friendship do you want more of in this season of life?" },
  { id: "n11", level: "connection", audiences: ["group"], text: "What is one rule for belonging you wish every community practiced?" },
  { id: "n12", level: "connection", audiences: all, text: "What is a risk you took that quietly shaped who you became?" },

  { id: "r01", level: "reflection", audiences: all, text: "What do you hope the people close to you never doubt about you?" },
  { id: "r02", level: "reflection", audiences: all, text: "What are you ready to make more room for this year?" },
  { id: "r03", level: "reflection", audiences: all, text: "What is a thank-you you have been meaning to express?" },
  { id: "r04", level: "reflection", audiences: all, text: "What would you like someone here to remind you of when you forget?" },
  { id: "r05", level: "reflection", audiences: all, text: "What does being truly known mean to you right now?" },
  { id: "r06", level: "reflection", audiences: all, text: "Name something you admire in the way another person here moves through life." },
  { id: "r07", level: "reflection", audiences: all, text: "What conversation do you want to continue after tonight?" },
  { id: "r08", level: "reflection", audiences: all, text: "What promise to yourself would feel meaningful to keep this month?" },
  { id: "r09", level: "reflection", audiences: ["couple"], text: "What is one memory with me you hope we will still retell years from now?" },
  { id: "r10", level: "reflection", audiences: ["friends"], text: "How can your friends show up for you more honestly right now?" },
  { id: "r11", level: "reflection", audiences: ["group"], text: "What quality did someone at this table bring into this conversation?" },
  { id: "r12", level: "reflection", audiences: all, text: "Finish this sentence: I feel most connected when..." }
];

export function promptById(id) {
  return PROMPTS.find((prompt) => prompt.id === id);
}
