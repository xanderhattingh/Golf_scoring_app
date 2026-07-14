const STORAGE_KEYS = {
    COURSES: 'golf_scoring_courses',
    PLAYERS: 'golf_scoring_players',
    ROUNDS: 'golf_scoring_rounds',
    USER: 'Golf_Scoring_User'
};

const DEFAULT_SCORING_METHODS = [
    {id: 1, name: 'Stroke Play', description: 'Total strokes for the round'},
    {id: 2, name: 'Stableford', description: 'Points based on score relative to par'},
    {id: 3, name: 'Match Play', description: 'Hole-by-hole competition'},
    {id: 4, name: 'Stableford with Pink', description: 'One player per hole gets double points with the pink ball'},
    {id: 5, name: 'Stableford with Animals', description: 'Stableford with Tree, Water, Bunker, and 3-Putt tracking per 9 holes'},
    {id: 6, name: 'Stableford with Animals and Pink', description: 'Stableford with Animals plus Pink Ball double points'}
];

export interface Hole {
    hole_number: number;
    hole_par: number;
    hole_stroke: number;
}

export interface Course {
    id: number;
    name: string;
    holes: Hole[];
    created_at: string;
}

export interface Player {
    id: number;
    name: string;
    handicap: number;
    created_at: string;
}

export interface Team {
    id: number;
    name: string;
    playerIds: number[];
}

export interface PlayerScore {
    team_id: number | null;
    playerId: number;
    strokes: number;
    points: number;
}

export type AnimalType = 'tree' | 'water' | 'bunker' | 'three_putt';

export interface AnimalEvent {
    playerId: number;
    animalType: AnimalType;
    holeNumber: number;
    timestamp: string;
}

export interface HoleScore {
    holeNumber: number;
    playerScores: PlayerScore[];
    pinkPlayerId?: number | null; // Player with pink ball for this hole (Stableford with Pink)
    pinkAssignedAt?: string; // ISO timestamp when pink was assigned (for rotation tracking)
    animalEvents?: AnimalEvent[]; // Animal events for this hole
}

export interface AnimalHolders {
    front9: Record<AnimalType, { playerId: number; holeNumber: number } | null>;
    back9: Record<AnimalType, { playerId: number; holeNumber: number } | null>;
}

export interface Round {
    id: number;
    course: Course;
    players: Player[];
    scoring_method: { id: number; name: string; description?: string };
    date: string;
    completed: boolean;
    created_at: string;
    format: 'individual' | 'teams';
    teams?: Team[];
    scores: HoleScore[];
    currentHole: number;
    scores_count?: number;
    animalHolders?: AnimalHolders; // Current animal holders for front9 and back9
    scoring_config?: { alliance?: { par3: number; par4: number; par5: number } } | null;
}

export interface ScoringMethod {
    id: number;
    name: string;
    description?: string;
}

function generateId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function getFromStorage<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(key);
    if (data) {
        return JSON.parse(data);
    }
    return defaultValue;
}

function saveToStorage<T>(key: string, data: T): void {
    localStorage.setItem(key, JSON.stringify(data));
}

export default class LocalDataService {
    // Courses
    getCourses(): Course[] {
        return getFromStorage<Course[]>(STORAGE_KEYS.COURSES, []);
    }

    addCourse(courseData: { course_name: string; holes: Hole[] }): Course {
        const courses = this.getCourses();
        const existingCourse = courses.find(
            c => c.name.toLowerCase() === courseData.course_name.toLowerCase()
        );
        if (existingCourse) {
            throw {status: 422, message: 'Course already exists'};
        }

        const newCourse: Course = {
            id: generateId(),
            name: courseData.course_name,
            holes: courseData.holes,
            created_at: new Date().toISOString()
        };
        courses.push(newCourse);
        saveToStorage(STORAGE_KEYS.COURSES, courses);
        return newCourse;
    }

    updateCourse(courseData: { course_id: number; course_name: string; holes: Hole[] }): Course {
        const courses = this.getCourses();
        const index = courses.findIndex(c => c.id === courseData.course_id);
        if (index === -1) {
            throw {status: 404, message: 'Course not found'};
        }

        const existingCourse = courses.find(
            c => c.name.toLowerCase() === courseData.course_name.toLowerCase() && c.id !== courseData.course_id
        );
        if (existingCourse) {
            throw {status: 422, message: 'Course already exists'};
        }

        courses[index] = {
            ...courses[index],
            name: courseData.course_name,
            holes: courseData.holes
        };
        saveToStorage(STORAGE_KEYS.COURSES, courses);
        return courses[index];
    }

    // Players
    getPlayers(): Player[] {
        return getFromStorage<Player[]>(STORAGE_KEYS.PLAYERS, []);
    }

    addPlayer(playerData: { name: string; handicap: number }): Player {
        const players = this.getPlayers();
        const existingPlayer = players.find(
            p => p.name.toLowerCase() === playerData.name.toLowerCase()
        );
        if (existingPlayer) {
            throw {status: 422, message: 'Player already exists'};
        }

        const newPlayer: Player = {
            id: generateId(),
            name: playerData.name,
            handicap: playerData.handicap,
            created_at: new Date().toISOString()
        };
        players.push(newPlayer);
        saveToStorage(STORAGE_KEYS.PLAYERS, players);
        return newPlayer;
    }

    updatePlayer(playerData: { player_id: number; name: string; handicap: number }): Player {
        const players = this.getPlayers();
        const index = players.findIndex(p => p.id === playerData.player_id);
        if (index === -1) {
            throw {status: 404, message: 'Player not found'};
        }

        const existingPlayer = players.find(
            p => p.name.toLowerCase() === playerData.name.toLowerCase() && p.id !== playerData.player_id
        );
        if (existingPlayer) {
            throw {status: 422, message: 'Player already exists'};
        }

        players[index] = {
            ...players[index],
            name: playerData.name,
            handicap: playerData.handicap
        };
        saveToStorage(STORAGE_KEYS.PLAYERS, players);
        return players[index];
    }

    // Rounds
    getRounds(): Round[] {
        return getFromStorage<Round[]>(STORAGE_KEYS.ROUNDS, []);
    }

    getRound(roundId: number): Round | undefined {
        const rounds = this.getRounds();
        return rounds.find(r => r.id === roundId);
    }

    updateRound(round: Round): Round {
        const rounds = this.getRounds();
        const index = rounds.findIndex(r => r.id === round.id);
        if (index === -1) {
            throw {status: 404, message: 'Round not found'};
        }
        rounds[index] = round;
        saveToStorage(STORAGE_KEYS.ROUNDS, rounds);
        return round;
    }

    deleteRound(roundId: number): void {
        const rounds = this.getRounds();
        const index = rounds.findIndex(r => r.id === roundId);
        if (index === -1) {
            throw {status: 404, message: 'Round not found'};
        }
        rounds.splice(index, 1);
        saveToStorage(STORAGE_KEYS.ROUNDS, rounds);
    }

    createRound(roundData: {
        course_id: number;
        player_ids: number[];
        scoring_method_id: number;
        date: string;
        format: 'individual' | 'teams';
        teams?: { name: string; playerIds: number[] }[];
    }): Round {
        const courses = this.getCourses();
        const players = this.getPlayers();
        const rounds = this.getRounds();

        const course = courses.find(c => c.id === roundData.course_id);
        if (!course) {
            throw {status: 404, message: 'Course not found'};
        }

        const selectedPlayers = players.filter(p => roundData.player_ids.includes(p.id));
        if (selectedPlayers.length !== roundData.player_ids.length) {
            throw {status: 404, message: 'One or more players not found'};
        }

        const scoringMethod = DEFAULT_SCORING_METHODS.find(m => m.id === roundData.scoring_method_id);
        if (!scoringMethod) {
            throw {status: 404, message: 'Scoring method not found'};
        }

        const isAnimalScoring = scoringMethod.id === 5 || scoringMethod.id === 6;
        
        const newRound: Round = {
            id: generateId(),
            course,
            players: selectedPlayers,
            scoring_method: scoringMethod,
            date: roundData.date,
            completed: false,
            created_at: new Date().toISOString(),
            format: roundData.format,
            teams: roundData.teams?.map((t, idx) => ({
                id: idx + 1,
                name: t.name,
                playerIds: t.playerIds
            })),
            scores: [],
            currentHole: 1,
            ...(isAnimalScoring && {
                animalHolders: {
                    front9: { tree: null, water: null, bunker: null, three_putt: null },
                    back9: { tree: null, water: null, bunker: null, three_putt: null }
                }
            })
        };
        rounds.push(newRound);
        saveToStorage(STORAGE_KEYS.ROUNDS, rounds);
        return newRound;
    }

    // Get data for create round modal
    getCreateRoundData(): {
        courses: Course[];
        players: Player[];
        scoring_methods: ScoringMethod[];
    } {
        return {
            courses: this.getCourses(),
            players: this.getPlayers(),
            scoring_methods: DEFAULT_SCORING_METHODS
        };
    }

    // Initialize default user for local-only mode
    initializeLocalUser(): void {
        const userData = localStorage.getItem(STORAGE_KEYS.USER);
        if (!userData) {
            const defaultUser = {
                user: {
                    id: 1,
                    email: 'local@golfer.com',
                    name: 'Local Golfer'
                },
                authorisation: {
                    token: 'local-mode-token'
                }
            };
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(defaultUser));
        }
    }
}
