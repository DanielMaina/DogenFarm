import { MenuEntry } from '@mozartfinance/uikit'

const config: MenuEntry[] = [
  {
    label: 'Home',
    icon: 'HomeIcon',
    href: '/swap',
  },
  {
    label: 'Trade',
    icon: 'TradeIcon',
    items: [
      {
        label: 'Exchange',
        href: '/swap',
      },
      {
        label: 'Liquidity',
        href: '/pool',
      },
    ],
  },
  {
    label: 'Farms',
    icon: 'FarmIcon',
    href: '/farms',
  },
  // {
  //   label: 'Pools',
  //   icon: 'PoolIcon',
  //   href: '',
  // },
  {
    label: 'More',
    icon: 'MoreIcon',
    items: [
      // {
      //   label: 'Github',
      //   href: '',
      // },
      {
        label: 'Docs',
        href: 'https://dogenswap.gitbook.io/docs/',
      },
      // {
      //   label: 'Blog',
      //   href: '',
      // },
    ],
  },
]

export default config
