export function mapFormToContact(formData, companyHQId) {
  if (!companyHQId) {
    throw new Error('CompanyHQId is required to create a contact');
  }

  return {
    crmId: companyHQId,
    firstName: formData.firstName || null,
    lastName: formData.lastName || null,
    goesBy: formData.goesBy || null,
    email: formData.email || null,
    phone: formData.phone || null,
    title: formData.title || null,
    notes: formData.notes || null,
    buyerDecision: formData.buyerDecision || null,
    howMet: formData.howMet || null,
    contactCompanyId: null,
  };
}

export function mapFormToCompany(formData, companyHQId) {
  if (!formData.companyName || formData.companyName.trim() === '') {
    return null;
  }

  return {
    companyHQId,
    companyName: formData.companyName.trim(),
    industry: formData.companyIndustry || null,
  };
}

export function mapFormToPipeline(formData) {
  if (!formData.pipeline || formData.pipeline.trim() === '') {
    return null;
  }

  return {
    pipeline: formData.pipeline,
    stage: formData.stage || null,
  };
}

export function validateContactForm(formData) {
  const errors = [];

  if (!formData.firstName || formData.firstName.trim() === '') {
    errors.push('First name is required');
  }

  if (!formData.lastName || formData.lastName.trim() === '') {
    errors.push('Last name is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPipelineStages(pipelineType) {
  const stageMap = {
    prospect: ['interest', 'meeting', 'proposal', 'negotiation', 'qualified'],
    client: ['onboarding', 'active', 'renewal', 'upsell'],
    collaborator: ['initial', 'active', 'partnership'],
    institution: ['awareness', 'engagement', 'partnership'],
  };

  return stageMap[pipelineType] || [];
}

