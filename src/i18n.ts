import type { Level, Prompt } from "./types";

export type Language = "en" | "pt-PT";

export const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "en", label: "English" },
  { code: "pt-PT", label: "Português" }
];

const UI_PT: Record<string, string> = {
  "Open Thread": "Open Thread",
  Install: "Instalar",
  Saved: "Guardadas",
  "Conversation card game": "Jogo de cartas de conversa",
  Curiosity: "Curiosidade",
  Connection: "Ligação",
  Reflection: "Reflexão",
  complete: "concluído",
  "Get closer, one honest question at a time.": "Aproximem-se, uma pergunta honesta de cada vez.",
  "Play from one phone or create a room so every player can follow along on their own screen across three levels.":
    "Joguem num só telemóvel ou criem uma sala para cada pessoa acompanhar no seu ecrã, ao longo de três níveis.",
  "Session in progress": "Sessão em curso",
  "Resume game": "Retomar jogo",
  "Start over": "Começar de novo",
  "How are you playing?": "Como vão jogar?",
  "One phone": "Um telemóvel",
  "Host room": "Criar sala",
  "Join room": "Entrar numa sala",
  "Who is playing?": "Quem vai jogar?",
  "Two people": "Duas pessoas",
  "Dates or partners": "Encontros ou casais",
  Friends: "Amigos",
  "New or longtime": "Recentes ou de longa data",
  Group: "Grupo",
  "Three or more": "Três ou mais",
  "Names or table name": "Nomes ou nome da mesa",
  optional: "opcional",
  "Your name": "O teu nome",
  "shown in the room": "visível na sala",
  "Choose an experience": "Escolhe uma experiência",
  Conversation: "Conversa",
  "A gentle shared deck for open conversation.": "Um baralho partilhado e leve para conversar sem pontuações.",
  "2 players | Shared goal": "2 jogadores | Objectivo partilhado",
  "3-6 friends | Points": "3-6 amigos | Pontos",
  "3-6 players | Shared goal": "3-6 jogadores | Objectivo partilhado",
  "Build a connection milestone together.": "Construam juntos um marco de ligação.",
  "Playfully compete with balanced targeting.": "Compitam de forma leve, com escolhas equilibradas.",
  "Meet the room through fair roulette.": "Conheçam o grupo através de uma roleta justa.",
  "Everyone follows one shared deck. No scores, only space to answer or pass.":
    "Todos seguem o mesmo baralho. Sem pontuações, só espaço para responder ou passar.",
  "Work together toward a shared milestone, then choose a closing moment.":
    "Trabalhem em conjunto até um marco partilhado e escolham um momento final.",
  "Private draws and points stay playful through balanced target cooldowns.":
    "As cartas privadas e os pontos mantêm-se leves com protecção de escolha equilibrada.",
  "A fair spin chooses responders while everyone builds group progress.":
    "Uma roleta justa escolhe quem responde enquanto o grupo progride em conjunto.",
  "Choose your themes": "Escolhe os temas",
  "Leave everything open, or pick any themes you want this A Table 4 Two deck to include.":
    "Deixa tudo em aberto ou escolhe os temas que queres incluir neste baralho A Table 4 Two.",
  "All themes": "Todos os temas",
  "Include spicy prompts": "Incluir perguntas Spicy",
  "Opt-in only. These are more provocative and are still pass-friendly.":
    "Só por escolha explícita. São perguntas mais provocadoras, mas passar continua sempre disponível.",
  "Available prompts by level": "Perguntas disponíveis por nível",
  "All themes selected.": "Todos os temas seleccionados.",
  "Selected: {themes}.": "Seleccionados: {themes}.",
  "Choose broader themes. A Table 4 Two needs at least 2 prompts in every level.":
    "Escolhe temas mais abrangentes. A Table 4 Two precisa de pelo menos 2 perguntas em cada nível.",
  "Cards per level": "Cartas por nível",
  "Quick round - 12 cards": "Ronda rápida - 12 cartas",
  "Full round - 18 cards": "Ronda completa - 18 cartas",
  "Long round - 24 cards": "Ronda longa - 24 cartas",
  "We agree anyone can pass on a card, without explaining why.":
    "Concordamos que qualquer pessoa pode passar uma carta, sem explicar porquê.",
  "I agree anyone can pass on a card, without explaining why.":
    "Concordo que qualquer pessoa pode passar uma carta, sem explicar porquê.",
  "Create live room": "Criar sala ao vivo",
  "Start the conversation": "Começar a conversa",
  "Create {experience} room": "Criar sala {experience}",
  "Room code": "Código da sala",
  "Join conversation": "Entrar na conversa",
  Lobby: "Sala de espera",
  "A table for two.": "Uma mesa para dois.",
  "Waiting for one partner to join this shared Table.":
    "À espera que a outra pessoa entre nesta mesa partilhada.",
  "Both partners are here. The host can begin when you are comfortable.":
    "As duas pessoas já estão aqui. Quem criou a sala pode começar quando fizer sentido.",
  "Start A Table 4 Two": "Começar A Table 4 Two",
  Scoreboard: "Pontuações",
  Turn: "Turno",
  "Bailout used": "Saída segura usada",
  "Double Down used": "Aposta dobrada usada",
  "Gather your inner circle.": "Reúne o teu círculo íntimo.",
  "Open the room gently.": "Abram a sala com calma.",
  "Waiting for {count} more {kind} before you begin.": "À espera de mais {count} {kind} antes de começar.",
  "friend": "amigo",
  "friends": "amigos",
  "player": "jogador",
  "players": "jogadores",
  "{count} {kind} are ready. The host can begin when everyone is settled.":
    "{count} {kind} estão prontos. Quem criou a sala pode começar quando estiver tudo tranquilo.",
  "Start Inner Circle": "Começar Inner Circle",
  "Start Icebreaker": "Começar Icebreaker",
  "Themes: {themes}": "Temas: {themes}",
  "Spicy ON": "Spicy ON",
  "Spicy OFF": "Spicy OFF",
  "Passing is always welcome. No explanation needed.": "Passar é sempre bem-vindo. Não é preciso explicar.",
  "Share invite": "Partilhar convite",
  "Turn {turn}": "Turno {turn}",
  "{name} responds": "{name} responde",
  "{name} facilitates": "{name} facilita",
  "{name}'s turn": "Turno de {name}",
  "Shared milestone": "Marco partilhado",
  "Together to 15": "Juntos até 15",
  "First to 21": "Primeiro aos 21",
  "Connection Meter": "Medidor de ligação",
  "Group progress": "Progresso do grupo",
  "Choose a challenge": "Escolhe um desafio",
  left: "restantes",
  "Double Down": "Dobrar a aposta",
  "double their reward; lose the card's base value if they complete it.":
    "duplica a recompensa da outra pessoa; perdes o valor base da carta se ela completar.",
  "Prompt concealed": "Pergunta escondida",
  "Private preview": "Pré-visualização privada",
  "Spin when the room is ready. The prompt appears once a responder is chosen.":
    "Gira quando o grupo estiver pronto. A pergunta aparece quando for escolhida a pessoa que responde.",
  "The facilitator is spinning for a responder.": "Quem facilita está a sortear a pessoa que responde.",
  "The active player is choosing who receives this prompt.": "A pessoa activa está a escolher quem recebe esta pergunta.",
  "Visible to both partners": "Visível para as duas pessoas",
  "Visible to the room": "Visível para a sala",
  "Only visible on your phone": "Visível só no teu telemóvel",
  point: "ponto",
  points: "pontos",
  "Prompt themes": "Temas da pergunta",
  "Prompts are spread around the group. Cooling down players return in the next cycle.":
    "As perguntas são distribuídas pelo grupo. Pessoas em pausa voltam no próximo ciclo.",
  "Cooling down": "Em pausa",
  "Shared milestone reached": "Marco partilhado alcançado",
  "How would you like to close tonight?": "Como querem fechar esta noite?",
  "Do Something Together": "Fazer algo juntos",
  "One More Meaningful Question": "Mais uma pergunta significativa",
  "Spin for responder": "Sortear resposta",
  Completed: "Completado",
  Pass: "Passar",
  Bailout: "Saída segura",
  "Claim this prompt": "Responder a esta pergunta",
  Discard: "Descartar",
  "Skip stalled turn": "Saltar turno bloqueado",
  "Save card": "Guardar carta",
  "Saved cards": "Cartas guardadas",
  "Open saved cards": "Abrir cartas guardadas",
  "Saved cards cleared": "Cartas guardadas limpas",
  "Saved for later": "Guardada para mais tarde",
  "Removed from saved cards": "Removida das cartas guardadas",
  "Invite shared": "Convite partilhado",
  "Invite link copied": "Link de convite copiado",
  "Invite players": "Convidar jogadores",
  "QR code invite": "Código QR do convite",
  "Scan this code or share the link so players can join from their own phones.":
    "Digitaliza este código ou partilha o link para os jogadores entrarem nos seus telemóveis.",
  Share: "Partilhar",
  "Copy link": "Copiar link",
  "Reconnecting to live room...": "A restabelecer ligação à sala...",
  "That room is no longer active": "Essa sala já não está activa",
  "Joined room {code}": "Entraste na sala {code}",
  "Room {code} is live": "A sala {code} está activa",
  "{experience} room {code} is open": "A sala {experience} {code} está aberta",
  "{experience} room {code} is {state}.": "A sala {experience} {code} está {state}.",
  "waiting in the lobby": "à espera na sala",
  "ready to review results": "pronta para rever resultados",
  "playing turn {turn}": "no turno {turn}",
  Hosting: "A alojar",
  Joined: "Entrou",
  "{role} room {code}: card {current} of {total} is waiting.":
    "{role} sala {code}: carta {current} de {total} à espera.",
  "{name}: card {current} of {total} is waiting.": "{name}: carta {current} de {total} à espera.",
  "two people": "duas pessoas",
  "a group": "um grupo",
  "Experience complete": "Experiência concluída",
  "{winners} tie.": "{winners} empatam.",
  "{winner} wins.": "{winner} vence.",
  "The first player reached 21 points.": "A primeira pessoa chegou aos 21 pontos.",
  "The prompts are complete. Highest score takes the match.": "As perguntas acabaram. Ganha a pontuação mais alta.",
  "You reached a shared milestone.": "Alcançaram um marco partilhado.",
  "Thank you for meeting each other here.": "Obrigado por se encontrarem aqui.",
  "Together you reached {score} connection points and explored every depth.":
    "Juntos chegaram a {score} pontos de ligação e exploraram todos os níveis.",
  "You reached {score} connection points before this deck ended.":
    "Chegaram a {score} pontos de ligação antes de o baralho terminar.",
  "Your group reached the goal.": "O vosso grupo chegou ao objectivo.",
  "That was a good round.": "Foi uma boa ronda.",
  "Together you built {score} points of group connection.":
    "Juntos construíram {score} pontos de ligação em grupo.",
  "Your group built {score} points before the available prompts ended.":
    "O grupo construiu {score} pontos antes de acabarem as perguntas disponíveis.",
  "Leave room": "Sair da sala",
  "Your turn to answer. Choose a depth that feels right.": "É a tua vez de responder. Escolhe a profundidade que fizer sentido.",
  "{name} is choosing a prompt to answer.": "{name} está a escolher uma pergunta para responder.",
  "Share what feels true, then mark Completed. Passing is always welcome.":
    "Partilha o que te parecer verdadeiro e depois marca como Completado. Passar é sempre bem-vindo.",
  "{name} is answering this prompt.": "{name} está a responder a esta pergunta.",
  "You reached your shared milestone. Either partner can choose how to close tonight.":
    "Alcançaram o vosso marco partilhado. Qualquer um pode escolher como fechar a noite.",
  "You are facilitating. Pick a friendly depth for the group.": "Estás a facilitar. Escolhe uma profundidade acolhedora para o grupo.",
  "{name} is selecting a prompt level.": "{name} está a escolher um nível.",
  "The prompt is ready. Spin to fairly choose its responder.":
    "A pergunta está pronta. Gira para escolher justamente quem responde.",
  "{name} is spinning for a responder.": "{name} está a sortear quem responde.",
  "Answer aloud, then mark Completed, or Pass with no explanation needed.":
    "Responde em voz alta e marca Completado, ou Passa sem explicar.",
  "{name} is responding for the group.": "{name} está a responder para o grupo.",
  "Your turn. Choose how deep to go and whether to risk your Double Down.":
    "É a tua vez. Escolhe a profundidade e decide se queres arriscar a Aposta Dobrada.",
  "{name} is choosing a challenge.": "{name} está a escolher um desafio.",
  "Bailout respected. Choose a different player for this replacement prompt.":
    "Saída segura respeitada. Escolhe outra pessoa para esta pergunta de substituição.",
  "Only you can see this card. Choose who receives it.": "Só tu vês esta carta. Escolhe quem a recebe.",
  "{name} is selecting a player.": "{name} está a escolher uma pessoa.",
  "Answer the prompt, then confirm completion to claim its points.":
    "Responde à pergunta e confirma para ganhar os pontos.",
  "{name} chose to answer the passed prompt.": "{name} escolheu responder à pergunta passada.",
  "Answer aloud, then mark the prompt completed - or pass without explanation.":
    "Responde em voz alta e marca a pergunta como completada, ou passa sem explicar.",
  "{name} is responding.": "{name} está a responder.",
  "The prompt was passed. Answer it yourself for base points or discard it.":
    "A pergunta foi passada. Responde tu pelos pontos base ou descarta-a.",
  "{name} may claim or discard the passed prompt.": "{name} pode responder ou descartar a pergunta passada.",
  "Live room": "Sala ao vivo",
  "You control the shared deck. Invite players with this code.":
    "Tu controlas o baralho partilhado. Convida pessoas com este código.",
  "The host controls the shared deck. Reveals appear here live.":
    "Quem criou a sala controla o baralho. As cartas reveladas aparecem aqui em directo.",
  host: "anfitrião",
  unavailable: "indisponível",
  "Tap to reveal": "Tocar para revelar",
  "Read aloud, then take your time.": "Lê em voz alta e demora o tempo que precisares.",
  "Reveal prompt card": "Revelar pergunta",
  "Waiting for host to reveal prompt card": "À espera que o anfitrião revele a pergunta",
  "There is no right answer. Listening counts.": "Não há resposta certa. Ouvir também conta.",
  "Follow along here. The host reveals and advances the shared deck.":
    "Acompanha por aqui. O anfitrião revela e avança o baralho partilhado.",
  "Next card": "Próxima carta",
  "Pass and draw another": "Passar e tirar outra",
  "Conversation complete": "Conversa concluída",
  "Thanks for showing up.": "Obrigado por aparecerem de verdade.",
  "You completed {count} prompts with {name}. Keep the saved cards for a later conversation.":
    "Completaram {count} perguntas com {name}. Guardem as cartas favoritas para uma conversa futura.",
  "Play again": "Jogar outra vez",
  "Review saved cards": "Ver cartas guardadas",
  "Your collection": "A tua colecção",
  "Cards you save during play will appear here.": "As cartas que guardares durante o jogo aparecem aqui.",
  Close: "Fechar",
  Remove: "Remover",
  "Clear saved cards": "Limpar cartas guardadas",
  "Take a breath.": "Respirem fundo.",
  "Next up: {level}.": "A seguir: {level}.",
  Continue: "Continuar",
  "Waiting for host": "À espera do anfitrião",
  "Room {code}": "Sala {code}"
};

const LEVEL_PT: Record<string, Partial<Level>> = {
  curiosity: {
    name: "Curiosidade",
    number: "Nível 1",
    guidance: "Repara no que é fácil deixar passar.",
    completion: "A sala já aqueceu. Agora troquem pequenas observações por histórias reais."
  },
  connection: {
    name: "Ligação",
    number: "Nível 2",
    guidance: "Responde com uma história, não com uma performance.",
    completion: "Criaram espaço para honestidade. O último nível pergunta o que querem levar convosco."
  },
  reflection: {
    name: "Reflexão",
    number: "Nível 3",
    guidance: "Diz o que importa enquanto tens oportunidade.",
    completion: "Chegaram ao fim deste baralho."
  }
};

const TAG_PT: Record<string, string> = {
  Ambition: "Ambição",
  Childhood: "Infância",
  Conflict: "Conflito",
  Existential: "Existencial",
  Family: "Família",
  Future: "Futuro",
  Growth: "Crescimento",
  Habits: "Hábitos",
  Identity: "Identidade",
  Intimacy: "Intimidade",
  Lifestyle: "Estilo de vida",
  Meta: "Meta",
  Romance: "Romance",
  "Self-Image": "Auto-imagem",
  Social: "Social",
  Travel: "Viagem",
  Vulnerability: "Vulnerabilidade"
};

const PROMPT_PT: Record<string, string> = {
  c01: "Que detalhe de hoje provavelmente esquecerias daqui a uma semana?",
  c02: "Que coisa pequena muda quase sempre o teu humor para melhor?",
  c03: "Com o que é que te importavas profundamente quando tinhas dez anos?",
  c04: "Qual é um elogio que ainda te lembras de ter recebido?",
  c05: "Onde te sentes mais tu?",
  c06: "Que música, refeição ou cheiro te transporta instantaneamente para outro lugar?",
  c07: "Que hábito inofensivo teu é que as pessoas só descobrem com o tempo?",
  c08: "Sobre que assunto aprenderias mais só por prazer, sem utilidade prática?",
  c09: "Qual foi a tua primeira impressão de mim, e o que mudou?",
  c10: "A quem nesta mesa pedirias conselho sobre algo inesperado?",
  c11: "Que versão de uma tarde calma perfeita te atrai mais?",
  c12: "Que coisa estás à espera que pareça comum, mas importante?",
  d106: "Se tivéssemos de fazer já uma mala para uma viagem de carro de 10 horas, qual seria exactamente o teu papel no carro?",
  d107: "Que elogio muito específico e aparentemente aleatório adoras secretamente receber?",
  d108: "Qual é a tua actividade de domingo 'aborrecida' favorita?",
  d109: "Que pequeno detalhe estranho seria decisivo para ti numa casa?",
  d110: "Quando estás a tentar impressionar alguém num primeiro encontro, qual é a tua jogada ou tema de conversa habitual?",
  q101: "Se pudesses escolher qualquer pessoa no mundo, quem quererias como convidado para jantar?",
  q102: "Gostarias de ser famoso? De que forma?",
  q103: "Antes de fazeres uma chamada telefónica, costumas ensaiar o que vais dizer?",
  q104: "Como seria um dia 'perfeito' para ti?",
  q105: "Qual é a causa mais trivial e mesquinha que defenderias até ao fim?",
  q106: "Que coisa completamente inofensiva alguém pode fazer que te dá logo o 'ick'?",
  q107: "Qual é o teu maior luxo do dia-a-dia?",
  q108: "A morte de que personagem fictícia num filme ou livro te atingiu muito mais do que devia?",
  q109: "Que hábito estranho e inofensivo só tens quando estás completamente sozinho?",
  n01: "Que lição aprendeste mais tarde do que gostarias?",
  n02: "Quando é que te custa mais pedir ajuda?",
  n03: "Que parte da tua vida parece inacabada de uma forma entusiasmante?",
  n04: "Sobre que coisa estás a tentar ser mais gentil contigo?",
  n05: "Conta uma história sobre uma altura em que alguém te fez sentir incluído.",
  n06: "Para ti, como é sentir segurança com outra pessoa?",
  n07: "Que expectativa deixaste ir recentemente?",
  n08: "Que verdade sobre ti se tornou mais fácil dizer em voz alta?",
  n09: "De que forma te apoio que talvez eu não perceba que importa?",
  n10: "Que tipo de amizade queres mais nesta fase da vida?",
  n11: "Que regra de pertença gostarias que todas as comunidades praticassem?",
  n12: "Que risco tomaste que moldou discretamente quem te tornaste?",
  d206: "Que coisa subtil alguém pode fazer que te faz sentir imediatamente em segurança?",
  d207: "Quando estás completamente sobrecarregado, que apoio te ajuda mais: espaço, distracção ou conversar?",
  d208: "Que lição um desgosto ou falhanço passado te obrigou a aprender sobre ti?",
  d209: "Na tua família, como se demonstrava afecto quando estavas a crescer?",
  d210: "Que sonho ou objectivo raramente partilhas porque receias que pareça irrealista?",
  q110: "Se pudesses viver até aos 90 anos e manter a mente ou o corpo de alguém de 30 durante os últimos 60 anos, qual escolherias?",
  q111: "Pelo que te sentes mais grato na tua vida?",
  q112: "Se pudesses mudar alguma coisa na forma como foste criado, o que seria?",
  q113: "Tens 30 segundos: conta à pessoa escolhida a história da tua vida com o máximo detalhe possível.",
  q114: "Se acordasses amanhã com uma nova qualidade ou capacidade, qual gostarias que fosse?",
  q115: "Que elogio recebeste há anos e ainda hoje muda verdadeiramente o teu humor quando pensas nele?",
  q116: "Que opinião ou crença forte tinhas há cinco anos e agora mudaste completamente?",
  q117: "Que pequeno erro cometido há anos ainda te aparece na cabeça à noite?",
  q118: "Quando foi a última vez que sentiste verdadeiro orgulho em ti, e chegaste a contar a alguém?",
  q119: "Que medo tens sobre envelhecer que raramente admites em voz alta?",
  r01: "O que esperas que as pessoas próximas de ti nunca duvidem sobre ti?",
  r02: "Para que estás pronto para abrir mais espaço este ano?",
  r03: "Que agradecimento tens andado para expressar?",
  r04: "Do que gostarias que alguém aqui te lembrasse quando te esqueceres?",
  r05: "O que significa, para ti, ser verdadeiramente conhecido neste momento?",
  r06: "Diz algo que admiras na forma como outra pessoa aqui atravessa a vida.",
  r07: "Que conversa queres continuar depois desta noite?",
  r08: "Que promessa a ti próprio seria significativa cumprir este mês?",
  r09: "Que memória comigo esperas que ainda vamos contar daqui a muitos anos?",
  r10: "Como podem os teus amigos aparecer por ti de forma mais honesta neste momento?",
  r11: "Que qualidade trouxe alguém desta mesa para esta conversa?",
  r12: "Completa a frase: sinto-me mais ligado quando...",
  d311: "Quando imaginas uma vida tranquila daqui a 10 anos, como é uma terça-feira normal de manhã?",
  d312: "Que parte de ti ainda estás activamente a aprender a aceitar ou amar?",
  d313: "Qual foi o limite emocional mais difícil que tiveste de traçar para proteger a tua paz?",
  d314: "Que medo tens sobre apaixonar-te ou comprometer-te a longo prazo?",
  d315: "Com base na nossa conversa até agora, que pergunta me tens querido fazer mas ainda não encontraste o momento certo?",
  q120: "Se uma bola de cristal pudesse dizer-te a verdade sobre ti, a tua vida, o futuro ou qualquer outra coisa, o que quererias saber?",
  q121: "Há algo que sonhas fazer há muito tempo? Porque ainda não o fizeste?",
  q122: "Qual é a maior conquista da tua vida até agora?",
  q123: "O que mais valorizas numa amizade?",
  q124: "Qual é a tua memória mais preciosa?",
  q125: "Qual é a tua memória mais terrível?",
  q126: "Se soubesses que morrerias subitamente dentro de um ano, mudarias alguma coisa na forma como vives agora?",
  q127: "De todas as pessoas da tua família, a morte de quem te perturbaria mais, e porquê?",
  q128: "Que traço detestas nos outros e temes secretamente ter também?",
  q129: "Preferias perder todas as memórias passadas ou nunca mais conseguir criar memórias novas?",
  q130: "Com a vida de quem te estás a comparar mais neste momento, e como é que isso te afecta?",
  q131: "Com quem nesta sala achas que entrarias mais em choque se tivessem de viver juntos durante um mês?",
  q132: "Qual foi a razão mais caótica, egoísta ou mesquinha pela qual alguma vez terminaste uma relação ou amizade?",
  q133: "Que 'segredo' juraste guardar de um amigo e acabaste por contar a outra pessoa?",
  q134: "Alguma vez sabotaste activamente uma boa relação ou situação porque sentias que não a merecias?",
  q135: "Que julgamento fizeste sobre alguém nesta sala quando o conheceste e que agora sabes ser falso?"
};

const REWARD_PT: Record<string, string> = {
  "activity-01": "Escolham uma música um para o outro, oiçam sem fazer mais nada e partilhem porque a escolheram.",
  "activity-02": "Façam uma pequena caminhada juntos e cada um aponta três detalhes que normalmente deixaria passar.",
  "activity-03": "Planeiem um encontro pequeno para os próximos sete dias usando apenas coisas que já têm ou que podem fazer de graça.",
  "activity-04": "Preparem um snack ou bebida partilhada e dêem-lhe um nome que capture o ambiente desta noite.",
  "activity-05": "Pousem os telemóveis durante dez minutos e troquem uma memória favorita do último ano.",
  "activity-06": "Escrevam uma frase de encorajamento um para o outro para abrir num dia difícil.",
  "activity-07": "Escolham um sítio perto que nunca tenham explorado juntos e marquem uma data para lá ir.",
  "activity-08": "Sentem-se num sítio confortável e alternem a dizer três coisas que apreciam na vida que estão a construir.",
  "question-01": "Que pequeno ritual gostarias que começássemos juntos?",
  "question-02": "Que parte desta noite te fez sentir mais compreendido?",
  "question-03": "Que tipo de apoio te parece especialmente significativo ultimamente?",
  "question-04": "Que coisa alegre esperas que arranjemos tempo para fazer nos próximos meses?",
  "question-05": "Quando te sentes mais à vontade comigo?",
  "question-06": "O que gostarias que nos lembrássemos sobre esta fase das nossas vidas?",
  "question-07": "Que promessa gentil poderíamos fazer um ao outro esta noite?",
  "question-08": "O que aprendeste sobre ligação que queres trazer para a nossa relação?"
};

export function format(template: string, values: Record<string, string | number> = {}) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function translate(key: string, language: Language, values: Record<string, string | number> = {}) {
  const template = language === "pt-PT" ? UI_PT[key] || key : key;
  return format(template, values);
}

export function localizeLevel(level: Level, language: Language): Level {
  return language === "pt-PT" ? { ...level, ...LEVEL_PT[level.id] } : level;
}

export function localizePrompt(prompt: Prompt, language: Language): Prompt {
  return language === "pt-PT" && PROMPT_PT[prompt.id]
    ? { ...prompt, text: PROMPT_PT[prompt.id] }
    : prompt;
}

export function translateTag(tag: string, language: Language) {
  return language === "pt-PT" ? TAG_PT[tag] || tag : tag;
}

export function localizeReward<T extends { id: string; text: string }>(reward: T, language: Language): T {
  return language === "pt-PT" && REWARD_PT[reward.id]
    ? { ...reward, text: REWARD_PT[reward.id] }
    : reward;
}

export function createI18n(language: Language) {
  return {
    language,
    t: (key: string, values?: Record<string, string | number>) => translate(key, language, values),
    level: (level: Level) => localizeLevel(level, language),
    prompt: (prompt: Prompt) => localizePrompt(prompt, language),
    tag: (tag: string) => translateTag(tag, language),
    reward: <T extends { id: string; text: string }>(reward: T) => localizeReward(reward, language)
  };
}
