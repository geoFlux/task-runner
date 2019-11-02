export interface Warning {
    warningType: string;
}

export class GenericWarning implements Warning{
    warningType = 'GenericWarning';
    constructor(
        public message: string
    ){
    }
}