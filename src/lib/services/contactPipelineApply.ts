/**
 * Shared pipeline update for a contact (single PUT + bulk).
 * Mirrors PUT /api/contacts/[contactId]/pipeline behavior.
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { validatePipeline, snapPipelineOnContact } from '@/lib/services/pipelineService';
import { applyPipelineTriggers } from '@/lib/services/PipelineTriggerService';

const NO_STAGE_PIPELINES = ['unassigned', 'no-role'];

export type ApplyContactPipelineBody = {
  pipeline: string;
  stage?: string | null;
};

export type ApplyContactPipelineResult =
  | {
      success: true;
      converted: boolean;
      pipeline: unknown;
      contact: unknown;
    }
  | { success: false; error: string };

export async function applyContactPipelineUpdate(
  contactId: string,
  body: ApplyContactPipelineBody,
): Promise<ApplyContactPipelineResult> {
  const { pipeline, stage: rawStage } = body;
  const stage = rawStage ?? undefined;

  if (!pipeline) {
    return { success: false, error: 'pipeline is required' };
  }

  if (!NO_STAGE_PIPELINES.includes(pipeline) && !stage) {
    return { success: false, error: 'stage is required for this pipeline' };
  }

  const stageToValidate = NO_STAGE_PIPELINES.includes(pipeline) ? null : stage;
  const validation = validatePipeline(pipeline, stageToValidate ?? undefined);
  if (!validation.isValid) {
    return { success: false, error: validation.error ?? 'Invalid pipeline or stage' };
  }

  const existingPipeline = await prisma.pipelines.findUnique({
    where: { contactId },
  });

  const convertedContact = await applyPipelineTriggers(contactId, pipeline, stage);
  if (convertedContact) {
    return {
      success: true,
      converted: true,
      pipeline: convertedContact.pipelines || convertedContact.pipeline,
      contact: convertedContact,
    };
  }

  const pipelineId = existingPipeline?.id || randomUUID();
  const stageValue = NO_STAGE_PIPELINES.includes(pipeline) ? null : stage ?? null;

  const updatedPipeline = await prisma.pipelines.upsert({
    where: { contactId },
    update: {
      pipeline,
      stage: stageValue,
    },
    create: {
      id: pipelineId,
      pipeline,
      stage: stageValue,
      contacts: { connect: { id: contactId } },
    },
  });

  await snapPipelineOnContact(contactId, pipeline, stageValue);

  const contactWithPipeline = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      pipelines: true,
      companies: true,
    },
  });

  return {
    success: true,
    converted: false,
    pipeline: updatedPipeline,
    contact: contactWithPipeline,
  };
}
