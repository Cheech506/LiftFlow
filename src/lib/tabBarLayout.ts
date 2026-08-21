export type TabBarPlatform = 'native' | 'web';

type TabBarLayout = {
  height: number;
  paddingBottom: number;
};

export const webTabLabelLayout = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 4,
  lineHeight: 14,
  textAlign: 'center' as const,
};

export function getTabBarLayout(platform: TabBarPlatform, bottomInset: number): TabBarLayout {
  const safeBottomInset = Math.max(bottomInset, 0);

  if (platform === 'web') {
    return {
      height: 72 + safeBottomInset,
      paddingBottom: Math.max(safeBottomInset, 10),
    };
  }

  return {
    height: 56 + safeBottomInset,
    paddingBottom: Math.max(safeBottomInset, 7),
  };
}
