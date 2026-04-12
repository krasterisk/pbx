export const selectContextsIsModalOpen = (state: any) =>
  state.contexts?.isModalOpen || false;

export const selectContextsSelectedContext = (state: any) =>
  state.contexts?.selectedContext || null;
