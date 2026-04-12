export const selectProvisionTemplatesIsModalOpen = (state: any) =>
  state.provisionTemplates?.isModalOpen || false;

export const selectProvisionTemplatesSelectedTemplate = (state: any) =>
  state.provisionTemplates?.selectedTemplate || null;
