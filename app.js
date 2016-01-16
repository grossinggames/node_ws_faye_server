
// ***************************************** Обработка неотловленных ошибок *******************************

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});


// ***************************************** Подключение библиотек *****************************************

var express =   require('express');
var faye    =   require('faye');

// Создание сервера
var app     =   express.createServer();
var port    =   3000; // configure as you wish

// Сервер для отправки Websocket сообщений с использованием faye
var bayeux  =   new faye.NodeAdapter({
    mount:      '/faye',
    timeout:    45
});


// ***************************************** Применение настроек *****************************************

// Конфигурация http сервера

app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use( express.bodyParser() );
    app.use( express.methodOverride() );
    app.use( express.cookieParser() );
    app.use( express.session({ secret: 'your secret here' }) );
    app.use(app.router);
    app.use( express.static(__dirname + '/public') );
});

//Непонятно что
app.configure('development', function() {
    app.use( express.errorHandler({ dumpExceptions: true, showStack: true }) );
});

//Непонятно что
app.configure('production', function() {
    app.use( express.errorHandler() );
});


// ***************************************** Маршрутизация настроек *****************************************

// Индекс
app.get('/', function(req, res) {
    res.render('index', {
        title: 'Channel: /chat/general'
    });
});

// Маршрутизация на запрос по корню
app.get('/get_channel', function(req, res) {
    var channel = getChannel();
    res.status(200).send( String(channel) );
});


// ***************************************** Старт сервера *****************************************

// Прослушивание порта
bayeux.attach(app);

app.listen(port, function() {
    // Логгирование. Порт и режим продакшн или разработка
    console.log('Express server listening on port %d in %s mode', app.address().port, app.settings.env);

    //subscribeOnChannel('/chat/general');

    addEventControllers();
});


// ***************************************** Поиск и создание каналов *****************************************

// Каналы
var channels = {
    available: {
         // "/chat/4": { count: 1 },
         // "/chat/5": { count: 2 },
         // "/chat/6": { count: 2 }
    },
    waiting: {
        // "/chat/7": { count: 1 },
        // "/chat/8": { count: 2 },
        // "/chat/9": { count: 2 }
    },
    full:      {
        // "/chat/1": { count: 3 },
        // "/chat/2": { count: 3 },
        // "/chat/2": { count: 3 }
    }
};

// Количество каналов
var countChannels = 0;

// Максимальное количество пользователей на одном канале. Минимальное количество 1
var maxUsersChanel = 2;

/*
                Запрос свободного канала от пользователя
    + Начинаем перебор массива channels.available методом for ( key in channels.available) { console.log(channels.available[key]); }
    + Берем первый ключ, останавливаем перебор
    + Переносим из channels.available в channels.waiting

    + Если нет ключей
    + Запускаем процедуру создания комнаты
    + Кладем сразу в channels.waiting
*/

// Получить имя свободного канала
function getChannel() {
    var channel = getAvailableChannel();
    if (!channel) {
        channel = createChannel();
    } else {
        moveToWaitingFromAvailable(channel);
    }
    return channel;
}

// Найти канал со свободным местом
function getAvailableChannel() {
    for (key in channels.available) {
        console.log('getAvailableChannel key = [ ' + key + ' ]');
        return key;
    }
    console.log('getAvailableChannel [key] = [ false ]');
    return false;
}

// Из waiting в full
function moveToFullFromWaiting(channel) {
    channels.full[channel] = { 
        count: channels.waiting[channel].count
    };
    delete channels.waiting[channel];
}

// Из waiting в available
function moveToAvailableFromWaiting(channel) {
    channels.available[channel] = { 
        count: channels.waiting[channel].count
    };
    delete channels.waiting[channel];
}

// Из available в waiting
function moveToWaitingFromAvailable(channel) {
    channels.waiting[channel] = { 
        count: channels.available[channel].count
    };
    delete channels.available[channel];
}

// Из available в full
function moveToFullFromAvailable(channel) {
    channels.full[channel] = { 
        count: channels.available[channel].count
    };
    delete channels.available[channel];
}

// Из full в available
function moveToAvailableFromFull(channel) {
    channels.available[channel] = { 
        count: channels.full[channel].count
    };
    delete channels.full[channel];
}

// Создать новый канал и записать в массивы
function createChannel() {
    countChannels++;
    var channel = '/chat/' + countChannels;
    channels.waiting[channel] = { count: 0 };
    console.log('Create channel = [ ' + channel + ' ]');
    return channel;
}


/*
                Подписка пользователя на канал
    + Ищем канал в channels.waiting
    + Увеличиваем на канале count на единицу
    + Если равно максимальному количеству пользователей переносим в channels.full если еще не там
    + Если меньше максимального количества пользователей переносим в channels.available если еще не там
*/

function onSubscribe(channel) {
    if (channels.waiting[channel]) {
        if (channels.waiting[channel].count < maxUsersChanel) {
            channels.waiting[channel].count++;
            if (channels.waiting[channel].count < maxUsersChanel) {
                moveToAvailableFromWaiting(channel);
            } else {
                moveToFullFromWaiting(channel);
            }
        } else {
            console.log('Ошибка! Количество пользователей на канала больше максимально разрешенных');
        }
    } else {
        console.log('Ошибка! Нет канала ' + channel + ' в объекте waiting');
    }
} 

/*
                Отписка пользователя с канала
    + Получаем название канала
    + Проверяем наличие канала в channels.available и channels.full если нет то в channels.waiting
    + Если есть где либо
    + Уменьшаем count на единицу
    + Если count меньше единицы удаляем канал полностью
    + Если больше единицы и он находится в channels.full переносим в channels.available

    Нужно тестировать!!!
*/

function clientUnsubscribe(channel, group) {
    switch (group) {
        case 'available':
            channels.available[channel].count--;
            if (channels.available[channel].count < 1) {
                console.log('Удаляем канал из available');
                delete channels.available[channel];
            }
            break;
        case 'waiting':
            channels.waiting[channel].count--;
            if (channels.waiting[channel].count < 1) {
                console.log('Удаляем канал из waiting');
                delete channels.waiting[channel];
            }
            break;
        case 'full':
            channels.full[channel].count--;
            if (channels.full[channel].count < 1) {
                delete channels.full[channel];
                console.log('Удаляем канал из full');
                return;
            } else if (channels.full[channel].count < maxUsersChanel) {
                console.log('Переносим канал из full в available');
                moveToAvailableFromFull(channel);
            } else {
                console.log('Ошибка! Пользователь отписался от канала, а число клиентов больше или равно максимально допустимому количеству на канале');
            }
            break;
        default:
            console.log('Ошибка не определена группа');
            break;
    }
}

function onUnsubscribe(channel) {
    if (channels.available[channel]) {
        console.log('Отписка от канала = ' + channel + ' который находится в available');
        clientUnsubscribe(channel, 'available');
    } else if (channels.full[channel]) {
        console.log('Отписка от канала = ' + channel + ' который находится в full');
        clientUnsubscribe(channel, 'full');
    } else if (channels.waiting[channel]) {
        console.log('Отписка от канала = ' + channel + ' который находится в waiting');
        clientUnsubscribe(channel, 'waiting');
    }
}

/*
                Механизм удаления каналов из waiting
    - Записываем время удаления expires = текущее время + 5 минут обнуляем значение секунд в большую сторону
    - Запускаем setInterval который каждую минуту проверяет channels.waiting.ИМЯ_КАНАЛА.expires, если часы и минуты равны ему, удаляем поле expires и
    - Переносим в channels.available если count меньше максимального
    - Переносим в channels.full если count равно или больше максимального
*/

// ***************************************** Контроллер каналов *****************************************

// Добавить подписчики контроллера каналов
function addEventControllers() {

    // Когда подключился новый клиент и ему выдается новый ID
    bayeux.on('handshake', function(clientId) {
        //console.log('Client handshake ', clientId);
    });

    // Подписался к каналу новый клиент
    bayeux.on('subscribe', function(clientId, channel) {
        console.log('Client subscribe ' + clientId + ' channel = ' + channel);
        if (channel != '/chat/general') {
            onSubscribe(channel);
        }
    });

    // Клиент отписался от канала
    bayeux.on('unsubscribe', function(clientId, channel) {
        console.log('Client unsubscribe ', clientId);
        onUnsubscribe(channel);
    });

    // Публикация в канал клиентом
    bayeux.on('publish', function(clientId, channel, data) {
        console.log('Client publish [' + clientId + '] channel = [ ' + channel + ' ] data = ' );
        console.log(data);
    });

    // На разрыв связи с клиентом
    bayeux.on('disconnect', function(clientId) {
        console.log('Client disconnect ', clientId);
    });

}


// ***************************************** Подписка и публикация в каналы клиентом сервера *****************************************

// Клиент
var client = bayeux.getClient();

// Подписаться на канал
function subscribeOnChannel(chanell) {
    client.subscribe(chanell, function(data) {
        //console.log(data.nick + ': ' + data.msg);
    });
}

// Отписаться от канала
function unsubscribeOnChannel(chanell) {
    client.unsubscribe(chanell);
}

// Отправить сообщение в канал
function publishOnChannel(chanell, msg, nick) {
    client.publish(chanell, {
        nick:      nick,
        msg:       msg
    });
}