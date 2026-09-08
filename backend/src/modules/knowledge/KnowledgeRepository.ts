import { Prisma } from '@prisma/client';
import { prisma,db } from '../../core/prisma.js';
import { knowledgeSchema,type KnowledgeInput,type KnowledgeItem } from './types.js';
export class KnowledgeRepository {
 async list():Promise<KnowledgeItem[]>{const rows=await db(()=>prisma.knowledgeEntity.findMany({orderBy:{updatedAt:'desc'}}));return rows.map(r=>({...knowledgeSchema.parse(r),id:r.id}));}
 async save(input:KnowledgeInput,id?:string){
 return db(()=>prisma.$transaction(async tx=>{
 const row=id?await tx.knowledgeEntity.update({where:{id},data:{...input,details:input.details as Prisma.InputJsonValue}}):await tx.knowledgeEntity.create({data:{...input,details:input.details as Prisma.InputJsonValue}});
 // Typed detail rows retain useful relational fields; canonical answer text is always reviewed by admin.
 await Promise.all([tx.schoolInfo.deleteMany({where:{entityId:row.id}}),tx.department.deleteMany({where:{entityId:row.id}}),tx.admissionPath.deleteMany({where:{entityId:row.id}}),tx.requirement.deleteMany({where:{entityId:row.id}}),tx.admissionSchedule.deleteMany({where:{entityId:row.id}}),tx.costInfo.deleteMany({where:{entityId:row.id}}),tx.fAQ.deleteMany({where:{entityId:row.id}})]);
 const entityId=row.id;const d=input.details;
 switch(input.category){
 case 'SCHOOL':await tx.schoolInfo.create({data:{entityId,academicYear:d.academicYear}});break;
 case 'DEPARTMENT':await tx.department.create({data:{entityId,quota:d.quota}});break;
 case 'PATH':await tx.admissionPath.create({data:{entityId,quota:d.quota}});break;
 case 'REQUIREMENT':await tx.requirement.create({data:{entityId,mandatory:d.mandatory??true}});break;
 case 'SCHEDULE':await tx.admissionSchedule.create({data:{entityId,startsAt:d.startsAt,endsAt:d.endsAt}});break;
 case 'COST':await tx.costInfo.create({data:{entityId,amount:d.amount,gender:d.gender}});break;
 case 'FAQ':await tx.fAQ.create({data:{entityId,question:d.question??input.title}});break;
 }
 return row;
 }));
 }
 remove(id:string){return db(()=>prisma.knowledgeEntity.delete({where:{id}}));}
}

