/**********************************************
 * Настройки
**********************************************/

// Ссылки на элементы чата
var chat            = $("#chat");
var message         = $("#message");
var submit          = $("#submit");
var conversation    = $("#container ul");
var nicknameDefault = "anonymous";
var nickname        = nicknameDefault;
var date            = new Date();


/**********************************************
 * Подключение к серверу
**********************************************/

// Данные сервера
var server          = "localhost:3000";
var serverMount     = "faye";
var client          = new Faye.Client('http://' + server + '/' + serverMount);
var channelGeneral  = "/chat/general";

// Подключение к вебсокетсервере
client.connect(function(){
    pushNotification(nickname);
});

// Подписаться на канал /chat/general & Установить активные действия
client.subscribe(channelGeneral, function(response) {
    updateChat(response.msg, response.nick);
});


/**********************************************
 * Управление & Интерактивность в приложении
**********************************************/

$(document).ready(function() {
    // Отключить элементы формы
    message.removeAttr('disabled');
    submit.removeAttr('disabled');

    // Установить фокус на строку ввода чата
    message.focus();

    // Запросить ник
    //nickname = prompt("Pick a NICKNAME, please!:", nicknameDefault);
    nickname = nicknameDefault;
    if(nickname == null) nickname = nicknameDefault;

    // Событие: Отправить сообщение
    chat.submit(function(e) {
        pushMessage(message.val(), nickname);

        // Prevent default's form action  Непонятно что
        e.preventDefault();
    });

    subscribeOnChannel();
});


/**********************************************
 * Методы подключения к столам
**********************************************/

var channelRoom     = "";

function subscribeOnChannel() {
    // Берем имя свободной комнаты
    $.ajax({
        url: "/get_channel",
        method: "get",
        success: function(data) {
            channelRoom = data;
            console.log('channelRoom = ' + channelRoom);
            // Подписаться на канал
            client.subscribe(channelRoom, function(response) {
                console.log('response = ' + response)
            });
        }
    });
}

function changeChannel() {
    // Отписаться от текущего канала
    client.unsubscribe('/chat/' + channelRoom, function() {
        // Подписаться на новый канал
        subscribeOnChannel();
    });
}


/**********************************************
 * Методы
**********************************************/

// Отправить сообщение всем подключенным клиентам
var pushMessage = function(message, nickname) {

    // Не отправляем пустые сообщения
    if (message != false)
        client.publish(channelGeneral, {
            msg: message,
            nick: nickname
        });

    // Очистить строку ввода в чате
    this.message.val("");
}

// Сообщение в общий чат о новом пользователе
var pushNotification = function(nickname) {
    var message = "has join the channel";
    client.publish(channelGeneral, {msg: message, nick: nickname});
}

// Сообщить всем о том что пользователь вышел
/* написать функционал */

// Обновление списка сообщение
var updateChat = function(msg, nick) {
    var time    = date.getHours() + ':' + date.getMinutes();
    msg         = escape(msg);

    this.conversation.append('<li>(<small>' + time + '</small>) <strong>' + nick + ' &mdash; </strong>' + msg + '</li>');

    // Хак: автоскролл к последнему сообщению
    this.conversation.scrollTop(999999);
}

// Экранирование от js инъекций
var escape = function(html) {
    return String(html)
        .replace(/&(?!\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}