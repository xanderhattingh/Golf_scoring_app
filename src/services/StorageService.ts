interface UserData {
    user: {
        id: number;
        name: string;
        surname: string;
        email: string | null;
        phone: string;
        handicap: number;
    };
    token: string;
}

export default class StorageService {
    private static STORAGE_KEY = "Golf_Scoring_User";

    set(value: UserData): void {
        localStorage.setItem(StorageService.STORAGE_KEY, JSON.stringify(value));
    }

    get(): UserData | null {
        const data = localStorage.getItem(StorageService.STORAGE_KEY);
        if (!data) return null;
        try {
            return JSON.parse(data) as UserData;
        } catch {
            return null;
        }
    }

    clear(): void {
        localStorage.removeItem(StorageService.STORAGE_KEY);
    }

    isLoggedIn(): boolean {
        const data = this.get();
        return !!(data?.token);
    }

    getToken(): string | null {
        return this.get()?.token || null;
    }

    getUser(): UserData['user'] | null {
        return this.get()?.user || null;
    }

    updateUser(user: Partial<UserData['user']>): void {
        const data = this.get();
        if (data) {
            data.user = { ...data.user, ...user };
            this.set(data);
        }
    }
}
