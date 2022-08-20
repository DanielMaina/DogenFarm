/* eslint-disable no-else-return */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable prefer-template */
/* eslint-disable prefer-destructuring */
/* eslint-disable consistent-return */
/* eslint-disable no-useless-return */
/* eslint-disable eqeqeq */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Contract } from '@ethersproject/contracts'
import { getAddress } from '@ethersproject/address'
import { AddressZero } from '@ethersproject/constants'
import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers'
import { BigNumber } from '@ethersproject/bignumber'
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { unwrappedToken } from './wrappedCurrency';
import { abi as IUniswapV2Router02ABI } from '@uniswap/v2-periphery/build/IUniswapV2Router02.json'
import { ChainId, JSBI, Percent, Token, CurrencyAmount, Currency, ETHER, Pair, TokenAmount } from '@pancakeswap-libs/sdk'
import { GlobalConst, GlobalValue, ROUTER_ADDRESS } from '../constants'
import { TokenAddressMap } from '../state/lists/hooks'
import { blockClient, client, txClient } from 'apollo/client';
import {
  GET_BLOCK,
  GLOBAL_DATA,
  GLOBAL_CHART,
  GET_BLOCKS,
  TOKENS_CURRENT,
  TOKENS_DYNAMIC,
  TOKEN_CHART,
  TOKEN_DATA1,
  TOKEN_DATA2,
  PAIR_CHART,
  PAIR_DATA,
  PAIRS_BULK1,
  PAIRS_HISTORICAL_BULK,
  PRICES_BY_BLOCK,
  PAIRS_CURRENT,
  ALL_PAIRS,
  ALL_TOKENS,
  TOKEN_INFO,
  TOKEN_INFO_OLD,
  FILTERED_TRANSACTIONS,
  SWAP_TRANSACTIONS,
  HOURLY_PAIR_RATES,
  GLOBAL_ALLDATA,
  ETH_PRICE,
  PAIR_ID,
} from 'apollo/queries';
import { CallState } from 'state/multicall/hooks'
import { StakingInfo, DualStakingInfo, StakingBasic, DualStakingBasic, SyrupBasic, SyrupInfo } from 'types'

dayjs.extend(utc);
dayjs.extend(weekOfYear);

// returns the checksummed address if the address is valid, otherwise returns false
export function isAddress(value: any): string | false {
  try {
    return getAddress(value)
  } catch {
    return false
  }
}

const BSCSCAN_PREFIXES: { [chainId in ChainId]: string } = {
  2000: '',
  568: 'testnet.'
}

export function getBscScanLink(chainId: ChainId, data: string, type: 'transaction' | 'token' | 'address'): string {
  const prefix = `https://${BSCSCAN_PREFIXES[chainId] || BSCSCAN_PREFIXES[ChainId.MAINNET]}explorer.dogechain.dog`

  switch (type) {
    case 'transaction': {
      return `${prefix}/tx/${data}`
    }
    case 'token': {
      return `${prefix}/token/${data}`
    }
    case 'address':
    default: {
      return `${prefix}/address/${data}`
    }
  }
}

// shorten the checksummed version of the input address to have 0x + 4 characters at start and end
export function shortenAddress(address: string, chars = 4): string {
  const parsed = isAddress(address)
  if (!parsed) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }
  return `${parsed.substring(0, chars + 2)}...${parsed.substring(42 - chars)}`
}

export async function getBlockFromTimestamp(timestamp: number): Promise<any> {
  const result = await blockClient.query({
    query: GET_BLOCK,
    variables: {
      timestampFrom: timestamp,
      timestampTo: timestamp + 600,
    },
    fetchPolicy: 'network-only',
  });
  return result?.data?.blocks?.[0]?.number;
}

// add 10%
export function calculateGasMargin(value: BigNumber): BigNumber { 
  return value.mul(BigNumber.from(10000).add(BigNumber.from(1000))).div(BigNumber.from(10000))
}


// converts a basis points value to a sdk percent
export function basisPointsToPercent(num: number): Percent {
  return new Percent(JSBI.BigInt(Math.floor(num)), JSBI.BigInt(10000))
}

export function calculateSlippageAmount(value: CurrencyAmount, slippage: number): [JSBI, JSBI] {
  if (slippage < 0 || slippage > 10000) {
    throw Error(`Unexpected slippage value: ${slippage}`)
  }
  return [
    JSBI.divide(JSBI.multiply(value.raw, JSBI.BigInt(10000 - slippage)), JSBI.BigInt(10000)),
    JSBI.divide(JSBI.multiply(value.raw, JSBI.BigInt(10000 + slippage)), JSBI.BigInt(10000))
  ]
}

export function getDaysCurrentYear() {
  const year = Number(dayjs().format('YYYY'));
  return (year % 4 === 0 && year % 100 > 0) || year % 400 == 0 ? 366 : 365;
}

export function getOneYearFee(dayVolume: number, reserveUSD: number) {
  if (!dayVolume || !reserveUSD) {
    return 0;
  }

  return (
    (dayVolume * GlobalConst.utils.FEEPERCENT * getDaysCurrentYear()) /
    reserveUSD
  );
}

export function formatTokenAmount(
  amount?: TokenAmount | CurrencyAmount,
  digits = 3,
) {
  if (!amount) return '-';
  const amountStr = amount.toExact();
  if (Math.abs(Number(amountStr)) > 1) {
    return Number(amountStr).toLocaleString();
  }
  return amount.toSignificant(digits);
}

// account is not optional
export function getSigner(library: Web3Provider, account: string): JsonRpcSigner {
  return library.getSigner(account).connectUnchecked()
}

// account is optional
export function getProviderOrSigner(library: Web3Provider, account?: string): Web3Provider | JsonRpcSigner {
  return account ? getSigner(library, account) : library
}

// account is optional
export function getContract(address: string, ABI: any, library: Web3Provider, account?: string): Contract {
  if (!isAddress(address) || address === AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }

  return new Contract(address, ABI, getProviderOrSigner(library, account) as any)
}

// account is optional
export function getRouterContract(_: number, library: Web3Provider, account?: string): Contract {
  return getContract(ROUTER_ADDRESS, IUniswapV2Router02ABI, library, account)
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function isTokenOnList(defaultTokens: TokenAddressMap, currency?: Currency): boolean {
  if (currency === ETHER) return true
  return Boolean(currency instanceof Token && defaultTokens[currency.chainId]?.[currency.address])
}

export function getFarmLPToken(
  info: StakingInfo | DualStakingInfo | StakingBasic | DualStakingBasic,
) {
  const lp = info.lp;
  const dummyPair = new Pair(
    new TokenAmount(info.tokens[0], '0'),
    new TokenAmount(info.tokens[1], '0'),
  );
  if (lp && lp !== '') return new Token(137, lp, 18, 'SLP', 'Staked LP');
  return dummyPair.liquidityToken;
}

export function getSyrupLPToken(info: SyrupBasic | SyrupInfo) {
  const lp = info.lp;
  if (lp && lp !== '') return new Token(137, lp, 18, 'SLP', 'Staked LP');
  return info.stakingToken;
}

export function getCallStateResult(callState?: CallState) {
  if (callState && callState.result) return callState.result[0];
  return;
}

export function initTokenAmountFromCallResult(
  token: Token,
  callState?: CallState,
) {
  if (!callState || !callState.result || !callState.result[0]) return;
  return new TokenAmount(token, JSBI.BigInt(callState.result[0]));
}

export function getStakedAmountStakingInfo(
  stakingInfo?: StakingInfo | DualStakingInfo,
  userLiquidityUnstaked?: TokenAmount,
) {
  if (!stakingInfo) return;
  const stakingTokenPair = stakingInfo.stakingTokenPair;
  const baseTokenCurrency = unwrappedToken(stakingInfo.baseToken);
  const empty = unwrappedToken(GlobalValue.tokens.COMMON.EMPTY);
  const token0 = stakingInfo.tokens[0];
  const baseToken =
    baseTokenCurrency === empty ? token0 : stakingInfo.baseToken;
  if (
    !stakingInfo.totalSupply ||
    !stakingTokenPair ||
    !stakingInfo.totalStakedAmount ||
    !stakingInfo.stakedAmount
  )
    return;
  // take the total amount of LP tokens staked, multiply by ETH value of all LP tokens, divide by all LP tokens
  const valueOfTotalStakedAmountInBaseToken = new TokenAmount(
    baseToken,
    JSBI.divide(
      JSBI.multiply(
        JSBI.multiply(
          stakingInfo.totalStakedAmount.raw,
          stakingTokenPair.reserveOf(baseToken).raw,
        ),
        JSBI.BigInt(2), // this is b/c the value of LP shares are ~double the value of the WETH they entitle owner to
      ),
      stakingInfo.totalSupply.raw,
    ),
  );

  const valueOfMyStakedAmountInBaseToken = new TokenAmount(
    baseToken,
    JSBI.divide(
      JSBI.multiply(
        JSBI.multiply(
          stakingInfo.stakedAmount.raw,
          stakingTokenPair.reserveOf(baseToken).raw,
        ),
        JSBI.BigInt(2), // this is b/c the value of LP shares are ~double the value of the WETH they entitle owner to
      ),
      stakingInfo.totalSupply.raw,
    ),
  );

  // get the USD value of staked WETH
  const USDPrice = stakingInfo.usdPrice;
  const valueOfTotalStakedAmountInUSDC = USDPrice?.quote(
    valueOfTotalStakedAmountInBaseToken,
  );

  const valueOfMyStakedAmountInUSDC = USDPrice?.quote(
    valueOfMyStakedAmountInBaseToken,
  );

  const stakedAmounts = {
    totalStakedBase: valueOfTotalStakedAmountInBaseToken,
    totalStakedUSD: valueOfTotalStakedAmountInUSDC,
    myStakedBase: valueOfMyStakedAmountInBaseToken,
    myStakedUSD: valueOfMyStakedAmountInUSDC,
    unStakedBase: undefined,
    unStakedUSD: undefined,
  };

  if (!userLiquidityUnstaked) return stakedAmounts;

  const valueOfUnstakedAmountInBaseToken = new TokenAmount(
    baseToken,
    JSBI.divide(
      JSBI.multiply(
        JSBI.multiply(
          userLiquidityUnstaked.raw,
          stakingTokenPair.reserveOf(baseToken).raw,
        ),
        JSBI.BigInt(2),
      ),
      stakingInfo.totalSupply.raw,
    ),
  );

  const valueOfUnstakedAmountInUSDC = USDPrice?.quote(
    valueOfUnstakedAmountInBaseToken,
  );
  return {
    ...stakedAmounts,
    unStakedBase: valueOfUnstakedAmountInBaseToken,
    unStakedUSD: valueOfUnstakedAmountInUSDC,
  };
}

export function getTokenFromAddress(
  tokenAddress: string,
  chainId: ChainId,
  tokenMap: TokenAddressMap,
  tokens: Token[],
) {
  const wrappedTokenInfo = tokenMap[chainId][tokenAddress];
  if (!wrappedTokenInfo) {
    console.log('missing from token list:' + tokenAddress);
    const token = tokens.find(
      (item) => item.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
    if (!token) {
      const commonToken = Object.values(GlobalValue.tokens.COMMON).find(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
      );
      if (!commonToken) {
        return GlobalValue.tokens.COMMON.EMPTY;
      }
      return commonToken;
    }
    return token;
  }

  return wrappedTokenInfo;
}

export function getAPYWithFee(rewards: number, fee: number) {
  return fee > 0 ? ((1 + ((rewards + fee / 12) * 12) / 12) ** 12 - 1) * 100 : 0;
}

export function getExactTokenAmount(amount?: TokenAmount | CurrencyAmount) {
  if (!amount) return 0;
  return Number(amount.toExact());
}

export function getPageItemsToLoad(index: number, countsPerPage: number) {
  return index === 0 ? countsPerPage : countsPerPage * index;
}

export function returnFullWidthMobile(isMobile: boolean) {
  return isMobile ? 1 : 'unset';
}

export function getTokenAddress(token: Token | undefined) {
  if (!token) return;
  if (token.symbol?.toLowerCase() === 'wmatic') return 'ETH';
  return token.address;
}

export function getRewardRate(rate?: TokenAmount, rewardToken?: Token) {
  if (!rate || !rewardToken) return;
  return `${rate.toFixed(2, { groupSeparator: ',' }).replace(/[.,]00$/, '')} ${
    rewardToken.symbol
  }  / day`;
}

export function getTVLStaking(
  valueOfTotalStakedAmountInUSDC?: CurrencyAmount,
  valueOfTotalStakedAmountInBaseToken?: TokenAmount,
) {
  if (!valueOfTotalStakedAmountInUSDC) {
    return `${formatTokenAmount(valueOfTotalStakedAmountInBaseToken)} ETH`;
  }
  return `$${formatTokenAmount(valueOfTotalStakedAmountInUSDC)}`;
}

export function getUSDString(usdValue?: CurrencyAmount) {
  if (!usdValue) return '$0';
  const value = Number(usdValue.toExact());
  if (value > 0 && value < 0.001) return '< $0.001';
  return `$${value.toLocaleString()}`;
}

export function getEarnedUSDLPFarm(stakingInfo: StakingInfo | undefined) {
  if (!stakingInfo || !stakingInfo.earnedAmount) return;
  const earnedUSD =
    Number(stakingInfo.earnedAmount.toExact()) * stakingInfo.rewardTokenPrice;
  if (earnedUSD < 0.001 && earnedUSD > 0) {
    return '< $0.001';
  }
  return `$${earnedUSD.toLocaleString()}`;
}

export function formatMulDivTokenAmount(
  amount?: TokenAmount,
  otherAmount?: number | string,
  operator = 'mul',
  digits = 3,
) {
  if (!amount || otherAmount === undefined) return '-';
  if (otherAmount === 0) return 0;

  const exactAmount = Number(amount.toExact());

  let resultAmount;
  if (operator === 'mul') resultAmount = exactAmount * Number(otherAmount);
  else resultAmount = exactAmount / Number(otherAmount);

  if (Math.abs(resultAmount) > 1) return resultAmount.toLocaleString();

  if (operator === 'mul')
    return amount.multiply(otherAmount.toString()).toSignificant(digits);
  return amount.divide(otherAmount.toString()).toSignificant(digits);
}

export function formatAPY(apy: number) {
  if (apy > 100000000) {
    return '>100000000';
  } else {
    return apy.toLocaleString();
  }
}

export function getEarnedUSDDualFarm(stakingInfo: DualStakingInfo | undefined) {
  if (!stakingInfo || !stakingInfo.earnedAmountA || !stakingInfo.earnedAmountB)
    return;
  const earnedUSD =
    Number(stakingInfo.earnedAmountA.toExact()) *
      stakingInfo.rewardTokenAPrice +
    Number(stakingInfo.earnedAmountB.toExact()) *
      Number(stakingInfo.rewardTokenBPrice);
  if (earnedUSD < 0.001 && earnedUSD > 0) {
    return '< $0.001';
  }
  return `$${earnedUSD.toLocaleString()}`;
}

export function formatNumber(
  unformatted: number | string | undefined,
  showDigits = 2,
) {
  // get fraction digits for small number
  if (!unformatted) return 0;
  const absNumber = Math.abs(Number(unformatted));
  if (absNumber > 0) {
    const digits = Math.ceil(Math.log10(1 / absNumber));
    if (digits < 3) {
      return Number(unformatted).toLocaleString();
    } else {
      return Number(unformatted).toFixed(digits + showDigits);
    }
  } else {
    return 0;
  }
}