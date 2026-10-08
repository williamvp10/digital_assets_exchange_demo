const { createApp } = require('./app');

createApp().listen(process.env.PORT || 3101, () => console.log('Compliance mock ready'));
