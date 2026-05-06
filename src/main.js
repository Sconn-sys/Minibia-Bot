(() => {
  const bundle = window.__minibiaBotBundle || window.__minibiaBotReloadBundle || {};

  function boot(currentBundle = bundle) {
    if (window.minibiaBot?.destroy) {
      window.minibiaBot.destroy();
    }

    const bot = currentBundle.createBot();

    currentBundle.installPzModule(bot);
    currentBundle.installXrayModule(bot);
    currentBundle.installPanicModule(bot);
    currentBundle.installRuneModule(bot);
    currentBundle.installHealModule(bot);
    currentBundle.installAutoEatModule(bot);
    currentBundle.installPanel(bot);

    bot.ui.inject();

    bot.start = (...args) => bot.rune.start(...args);
    bot.stop = (...args) => bot.rune.stop(...args);
    bot.reload = () => window.minibiaBotReload?.();
    bot.status = () => ({
      version: bot.version,
      pz: {
        home: bot.pz.getHomePz(),
      },
      xray: bot.xray.status(),
      panic: bot.panic.status(),
      rune: bot.rune.status(),
      heal: bot.heal.status(),
      eat: bot.eat.status(),
    });

    window.minibiaBot = bot;
    window.pzBot = bot.pz;

    console.log("[minibia-bot] ready", {
      version: bot.version,
      modules: ["pz", "xray", "panic", "rune", "heal", "eat", "ui"],
    });
    console.log("minibiaBot.reload()");
    console.log("minibiaBot.xray.status()");
    console.log("minibiaBot.panic.status()");
    console.log("minibiaBot.pz.goToNearestPz()");
    console.log("minibiaBot.pz.setHomePzCurrentSpot()");
    console.log("minibiaBot.pz.goToHomePz()");
    console.log("minibiaBot.rune.start()");
    console.log("minibiaBot.rune.stop()");
    console.log("minibiaBot.heal.start()");
    console.log("minibiaBot.heal.stop()");
    console.log("minibiaBot.eat.start()");
    console.log("minibiaBot.eat.stop()");
    return bot;
  }

  window.__minibiaBotReloadBundle = bundle;
  window.minibiaBotReload = () => boot(window.__minibiaBotReloadBundle || bundle);
  delete window.__minibiaBotBundle;
  boot(bundle);
})();
