import { parseBytes32String } from '@ethersproject/strings'
import { Currency, ETHER, Token, currencyEquals } from '@pancakeswap-libs/sdk'
import ERC20_INTERFACE, { ERC20_BYTES32_INTERFACE } from 'constants/abis/erc20'
import { useMemo } from 'react'
import { useSelectedTokenList } from '../state/lists/hooks'
import { NEVER_RELOAD, useMultipleContractSingleData, useSingleCallResult } from '../state/multicall/hooks'
// eslint-disable-next-line import/no-cycle
import { useUserAddedTokens } from '../state/user/hooks'
import { isAddress } from '../utils'

import { useActiveWeb3React } from './index'
import { useBytes32TokenContract, useTokenContract } from './useContract'

export function useAllTokens(): { [address: string]: Token } {
  const { chainId } = useActiveWeb3React()
  const userAddedTokens = useUserAddedTokens()
  const allTokens = useSelectedTokenList()

  return useMemo(() => {
    if (!chainId) return {}
    return (
      userAddedTokens
        // reduce into all ALL_TOKENS filtered by the current chain
        .reduce<{ [address: string]: Token }>(
          (tokenMap, token) => {
            tokenMap[token.address] = token
            return tokenMap
          },
          // must make a copy because reduce modifies the map, and we do not
          // want to make a copy in every iteration
          { ...allTokens[chainId] }
        )
    )
  }, [chainId, userAddedTokens, allTokens])
}

// Check if currency is included in custom list from user storage
export function useIsUserAddedToken(currency: Currency): boolean {
  const userAddedTokens = useUserAddedTokens()
  return !!userAddedTokens.find((token) => currencyEquals(currency, token))
}

// parse a name or symbol from a token response
const BYTES32_REGEX = /^0x[a-fA-F0-9]{64}$/
function parseStringOrBytes32(str: string | undefined, bytes32: string | undefined, defaultValue: string): string {
  return str && str.length > 0
    ? str
    : bytes32 && BYTES32_REGEX.test(bytes32)
    ? parseBytes32String(bytes32)
    : defaultValue
}

// undefined if invalid or does not exist
// null if loading
// otherwise returns the token
export function useToken(tokenAddress?: string): Token | undefined | null {
  const { chainId } = useActiveWeb3React()
  const tokens = useAllTokens()

  const address = isAddress(tokenAddress)

  const tokenContract = useTokenContract(address || undefined, false)
  const tokenContractBytes32 = useBytes32TokenContract(address || undefined, false)
  const token: Token | undefined = address ? tokens[address] : undefined

  const tokenName = useSingleCallResult(token ? undefined : tokenContract, 'name', undefined, NEVER_RELOAD)
  const tokenNameBytes32 = useSingleCallResult(
    token ? undefined : tokenContractBytes32,
    'name',
    undefined,
    NEVER_RELOAD
  )
  const symbol = useSingleCallResult(token ? undefined : tokenContract, 'symbol', undefined, NEVER_RELOAD)
  const symbolBytes32 = useSingleCallResult(token ? undefined : tokenContractBytes32, 'symbol', undefined, NEVER_RELOAD)
  const decimals = useSingleCallResult(token ? undefined : tokenContract, 'decimals', undefined, NEVER_RELOAD)

  return useMemo(() => {
    if (token) return token
    if (!chainId || !address) return undefined
    if (decimals.loading || symbol.loading || tokenName.loading) return null
    if (decimals.result) {
      return new Token(
        chainId,
        address,
        decimals.result[0],
        parseStringOrBytes32(symbol.result?.[0], symbolBytes32.result?.[0], 'UNKNOWN'),
        parseStringOrBytes32(tokenName.result?.[0], tokenNameBytes32.result?.[0], 'Unknown Token')
      )
    }
    return undefined
  }, [
    address,
    chainId,
    decimals.loading,
    decimals.result,
    symbol.loading,
    symbol.result,
    symbolBytes32.result,
    token,
    tokenName.loading,
    tokenName.result,
    tokenNameBytes32.result,
  ])
}

export function useCurrency(currencyId: string | undefined): Currency | null | undefined {
  const isBNB = currencyId?.toUpperCase() === 'DOGE'
  const token = useToken(isBNB ? undefined : currencyId)
  return isBNB ? ETHER : token
}

export function useTokens(
  tokenAddresses: string[],
): Token[] | undefined | null {
  const { chainId } = useActiveWeb3React();
  const tokens = useAllTokens();

  const tokenSet = [...new Set(tokenAddresses)];
  const validatedUnknownTokenAddresses = tokenSet
    .filter((x) => isAddress(x))
    .filter((x) => !tokens[x]);

  const tokenNames = useMultipleContractSingleData(
    validatedUnknownTokenAddresses,
    ERC20_INTERFACE,
    'name',
    undefined,
    NEVER_RELOAD,
  );

  const tokenNamesBytes32 = useMultipleContractSingleData(
    validatedUnknownTokenAddresses,
    ERC20_BYTES32_INTERFACE,
    'name',
    undefined,
    NEVER_RELOAD,
  );

  const symbols = useMultipleContractSingleData(
    validatedUnknownTokenAddresses,
    ERC20_INTERFACE,
    'symbol',
    undefined,
    NEVER_RELOAD,
  );

  const symbolsBytes32 = useMultipleContractSingleData(
    validatedUnknownTokenAddresses,
    ERC20_BYTES32_INTERFACE,
    'symbol',
    undefined,
    NEVER_RELOAD,
  );

  const tokenDecimals = useMultipleContractSingleData(
    validatedUnknownTokenAddresses,
    ERC20_INTERFACE,
    'decimals',
    undefined,
    NEVER_RELOAD,
  );

  const anyLoading: boolean = useMemo(
    () =>
      tokenNames.some((callState) => callState.loading) ||
      tokenNamesBytes32.some((callState) => callState.loading) ||
      symbols.some((callState) => callState.loading) ||
      symbolsBytes32.some((callState) => callState.loading) ||
      tokenDecimals.some((callState) => callState.loading),
    [tokenNames, tokenNamesBytes32, symbols, symbolsBytes32, tokenDecimals],
  );

  return useMemo(() => {
    const existingTokens = [...new Set(tokenAddresses)]
      .filter((x) => isAddress(x))
      .map((x) => tokens[x])
      .filter((x) => !!x);
    return validatedUnknownTokenAddresses.reduce<Token[]>(
      (memo, tokenAddress, index) => {
        if (anyLoading || !chainId) {
          return [];
        }

        const decimals = tokenDecimals[index];
        const symbol = symbols[index];
        const symbolBytes32 = symbolsBytes32[index];
        const tokenName = tokenNames[index];
        const tokenNameBytes32 = tokenNamesBytes32[index];

        if (decimals.result) {
          memo.push(
            new Token(
              chainId,
              tokenAddress,
              decimals.result[0],
              parseStringOrBytes32(
                symbol.result?.[0],
                symbolBytes32.result?.[0],
                'UNKNOWN',
              ),
              parseStringOrBytes32(
                tokenName.result?.[0],
                tokenNameBytes32.result?.[0],
                'Unknown Token',
              ),
            ),
          );
        }
        return memo;
      },
      existingTokens,
    );
  }, [
    tokenAddresses,
    validatedUnknownTokenAddresses,
    tokens,
    anyLoading,
    chainId,
    tokenDecimals,
    symbols,
    symbolsBytes32,
    tokenNames,
    tokenNamesBytes32,
  ]);
}
