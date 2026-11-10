<?php

$loader = require __DIR__ . '/../vendor/autoload.php';
$worktreeApp = realpath(__DIR__ . '/../app');

// Prepend worktree autoloader so worktree classes always take precedence over Composer's static classmap
spl_autoload_register(function ($class) use ($worktreeApp) {
    if (str_starts_with($class, 'App\\') && $worktreeApp) {
        $file = $worktreeApp . DIRECTORY_SEPARATOR . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, 4)) . '.php';
        if (file_exists($file)) {
            require_once $file;
            return true;
        }
    }
}, true, true);

$loader->setPsr4('App\\', [__DIR__ . '/../app']);
$loader->setPsr4('Tests\\', [__DIR__]);

