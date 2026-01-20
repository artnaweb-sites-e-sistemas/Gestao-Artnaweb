
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Transaction } from '../types';

const data = [
  { name: 'JAN', value: 30000 },
  { name: 'FEV', value: 45000 },
  { name: 'MAR', value: 38000 },
  { name: 'ABR', value: 55000 },
  { name: 'MAI', value: 68000 },
  { name: 'JUN', value: 52000 },
];

const barData = [
  { name: 'WEB', value: 85 },
  { name: 'APPS', value: 60 },
  { name: 'MARCA', value: 45 },
  { name: 'SEO', value: 30 },
  { name: 'DESIGN', value: 70 },
];

const recentTransactions: Transaction[] = [
  { id: '1', client: 'Skyline Retailers', project: 'Construção de Plataforma E-commerce', type: 'Web App', date: '12 Out, 2023', value: 12400, status: 'Paid', initials: 'SK', color: 'bg-primary/10 text-primary' },
  { id: '2', client: 'Nova Kinetics', project: 'Redesign de Identidade Visual', type: 'Branding', date: '10 Out, 2023', value: 4500, status: 'Pending', initials: 'NK', color: 'bg-purple-100 text-purple-600' },
  { id: '3', client: 'Green Motion', project: 'Conceito de App Mobile', type: 'App Mobile', date: '08 Out, 2023', value: 8200, status: 'Paid', initials: 'GM', color: 'bg-green-100 text-green-600' },
  { id: '4', client: 'Apex Ventures', project: 'Auditoria e Estratégia de SEO', type: 'Estratégia', date: '05 Out, 2023', value: 2100, status: 'Overdue', initials: 'AV', color: 'bg-orange-100 text-orange-600' },
];

export const Financial: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black leading-tight tracking-tight">Visão Geral Financeira</h1>
          <p className="text-slate-500 text-base font-normal">Saúde financeira em tempo real e métricas de serviços criativos</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-lg">download</span> Exportar
          </button>
          <button className="flex items-center gap-2 px-6 h-10 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all">
            <span className="material-symbols-outlined text-lg">add</span> Criar Fatura
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <KPICard title="Receita Total" value="R$ 124.500,00" trend="+12.5%" trendType="up" icon="trending_up" iconBg="bg-green-100" iconColor="text-green-600" />
        <KPICard title="Faturas Pendentes" value="R$ 18.200,00" trend="14 Pendentes" trendType="neutral" icon="pending_actions" iconBg="bg-amber-100" iconColor="text-amber-600" />
        <KPICard title="Despesas da Agência" value="R$ 45.300,00" trend="-2.1%" trendType="down" icon="account_balance_wallet" iconBg="bg-red-100" iconColor="text-red-600" />
        <KPICard title="Lucro Líquido" value="R$ 79.200,00" trend="+15.8%" trendType="up" icon="attach_money" iconBg="bg-primary/10" iconColor="text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold">Crescimento de Receita</h3>
              <p className="text-sm text-slate-500">Análise de tendência mensal</p>
            </div>
            <select className="bg-transparent border-none text-sm font-bold text-primary focus:ring-0">
              <option>Últimos 6 Meses</option>
              <option>Último Ano</option>
            </select>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#135bec" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#135bec" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#135bec" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold">Receita por Serviço</h3>
              <p className="text-sm text-slate-500">Alocação por departamento</p>
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <span className="material-symbols-outlined text-sm">trending_down</span>
              <span className="text-sm font-bold">-2.3%</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#135bec' : '#135bec99'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-lg font-bold">Transações Recentes</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors">Filtros</button>
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors">Tipo de Serviço</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Cliente & Projeto</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Tipo de Serviço</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`size-9 rounded ${tx.color} flex items-center justify-center font-bold text-xs`}>{tx.initials}</div>
                      <div>
                        <p className="text-sm font-bold">{tx.client}</p>
                        <p className="text-xs text-slate-500">{tx.project}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold">{tx.type}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{tx.date}</td>
                  <td className="px-6 py-4 text-sm font-bold text-right">R$ {tx.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1.5 ${tx.status === 'Paid' ? 'text-green-600' : tx.status === 'Pending' ? 'text-amber-600' : 'text-red-600'}`}>
                      <div className={`size-1.5 rounded-full ${tx.status === 'Paid' ? 'bg-green-600' : tx.status === 'Pending' ? 'bg-amber-600' : 'bg-red-600'}`}></div>
                      <span className="text-xs font-bold">{tx.status === 'Paid' ? 'Pago' : tx.status === 'Pending' ? 'Pendente' : 'Atrasado'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: string; trend: string; trendType: 'up' | 'down' | 'neutral'; icon: string; iconBg: string; iconColor: string }> = ({ title, value, trend, trendType, icon, iconBg, iconColor }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
    <div className="flex justify-between items-start mb-4">
      <div className={`size-10 ${iconBg} rounded-lg flex items-center justify-center ${iconColor}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendType === 'up' ? 'text-green-600 bg-green-50' : trendType === 'down' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'}`}>
        {trend}
      </span>
    </div>
    <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
    <p className="text-2xl font-black tracking-tight">{value}</p>
  </div>
);
