import { z } from 'zod';
export const categories=['SCHOOL','DEPARTMENT','PATH','REQUIREMENT','SCHEDULE','COST','FAQ','CONTACT','PROGRAM','CUSTOM'] as const;
export const knowledgeSchema=z.object({
 category:z.enum(categories),title:z.string().trim().min(2).max(180),content:z.string().trim().min(2).max(10000),
 keywords:z.array(z.string().trim().min(1).max(80)).max(30).default([]),verified:z.boolean().default(false),
 demo:z.boolean().default(false),details:z.object({
 quota:z.number().int().nonnegative().optional(),amount:z.number().nonnegative().optional(),
 gender:z.enum(['PEREMPUAN','LAKI_LAKI','SEMUA']).optional(),startsAt:z.string().datetime().optional(),
 endsAt:z.string().datetime().optional(),academicYear:z.string().max(30).optional(),
 mandatory:z.boolean().optional(),question:z.string().max(500).optional()
 }).default({})
});
export type KnowledgeInput=z.infer<typeof knowledgeSchema>;
export type KnowledgeItem=KnowledgeInput & {id:string};
export type Category=KnowledgeInput['category'];
export const labels:Record<Category,string>={SCHOOL:'Profil sekolah',DEPARTMENT:'Jurusan & kuota',PATH:'Jalur pendaftaran',REQUIREMENT:'Syarat berkas',SCHEDULE:'Jadwal & alur SPMB',COST:'Rincian biaya',FAQ:'Pertanyaan umum',CONTACT:'Kontak panitia',PROGRAM:'Program unggulan',CUSTOM:'Informasi tambahan'};

