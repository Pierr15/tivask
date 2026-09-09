ALTER TYPE "TicketStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_USER';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';

ALTER TABLE "Ticket" ADD COLUMN "topic" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ticket" ADD COLUMN "lastUserMessageAt" TIMESTAMP(3);

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "role" "MessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "whatsappMessageId" TEXT,
  "replyToMessageId" TEXT,
  "delivery" TEXT NOT NULL DEFAULT 'STORED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketMessage_whatsappMessageId_key" ON "TicketMessage"("whatsappMessageId");
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
