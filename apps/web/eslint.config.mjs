import nextPlugin from '@next/eslint-plugin-next';

import base from '@cognitest/config/eslint.base.mjs';

export default [...base, nextPlugin.configs['core-web-vitals']];
