export class AppError extends Error { constructor(public status:number,message:string){super(message);} }
export const errorMessage=(e:unknown)=>e instanceof Error?e.message:'Terjadi kesalahan';

