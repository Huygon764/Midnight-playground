export type SimpleCounterPrivateState = {
  readonly privateCounter: number;
};

export const createSimpleCounterPrivateState = (): SimpleCounterPrivateState => ({
  privateCounter: 0,
});

export const witnesses = {};
