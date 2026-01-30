import { getStages, deleteStage } from '../firebase/services';

// Script para limpar todas as etapas do Firebase
export const clearAllStages = async () => {
  try {
    console.log('Buscando todas as etapas...');
    const allStages = await getStages();
    console.log(`Encontradas ${allStages.length} etapas para excluir`);
    
    if (allStages.length === 0) {
      console.log('Nenhuma etapa encontrada.');
      return;
    }
    
    console.log('Excluindo todas as etapas...');
    await Promise.all(allStages.map(stage => {
      console.log(`Excluindo etapa: ${stage.id} - ${stage.title}`);
      return deleteStage(stage.id);
    }));
    
    console.log('✅ Todas as etapas foram excluídas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao excluir etapas:', error);
    throw error;
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  clearAllStages()
    .then(() => {
      console.log('Processo concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro:', error);
      process.exit(1);
    });
}








