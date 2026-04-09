import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Phone, Users, PhoneCall, Headphones, TrendingUp, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui';
import { useAppSelector } from '@/shared/hooks/useAppStore';

export const DashboardPage = () => {
  const { t } = useTranslation();
  const user = useAppSelector((s) => s.auth.user);

  const statsCards = [
    { title: t('dashboard.activeCalls'), value: '—', icon: PhoneCall, color: 'text-green-400', bgColor: 'bg-green-400/10' },
    { title: t('dashboard.peersOnline'), value: '—', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
    { title: t('dashboard.operators'), value: '—', icon: Headphones, color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
    { title: t('dashboard.callsToday'), value: '—', icon: TrendingUp, color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('dashboard.welcome')}, <span className="gradient-text">{user?.name || 'Admin'}</span>
        </h1>
        <p className="text-muted-foreground mt-1">{t('dashboard.systemOverview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Card className="hover:border-primary/30 transition-colors group cursor-default">
              <CardContent className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bgColor} transition-transform group-hover:scale-110`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Panels row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="min-h-[300px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {t('dashboard.currentCalls')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <div className="text-center">
                  <Phone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{t('dashboard.amiNotConnected')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="min-h-[300px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-purple-400" />
                {t('dashboard.queueStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <div className="text-center">
                  <Headphones className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{t('dashboard.queuesPlaceholder')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
