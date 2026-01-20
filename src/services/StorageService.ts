export default class StorageService {
    set(value: any) {
        localStorage.setItem("Golf_Scoring_User", JSON.stringify(value))
    }

    get(): any {
        return localStorage.getItem("Golf_Scoring_User")
    }
}
