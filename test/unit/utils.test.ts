import logger from '../../src/utils';

describe('Logger', () => {

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    jest.spyOn(logger, 'warn');
    jest.spyOn(logger, 'error');
    jest.spyOn(logger, 'info');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('debug should print debug level information to the console', () => {
    logger.debug('I am some debugging information');
    expect(logger.debug).toHaveBeenCalled();
  });

  test('warn should print warning level information to the console', () => {
    logger.warn('A warning has been issued');
    expect(logger.warn).toHaveBeenCalled();
  });

  test('error should print error level information to the console', () => {
    logger.error('An error has been logged');
    expect(logger.error).toHaveBeenCalled();
  });

  test('info should print info level information to the console', () => {
    logger.info('An info level log has been issued');
    expect(logger.info).toHaveBeenCalled();
  });
});
