CREATE TABLE IF NOT EXISTS consumed (
    `id` int auto_increment primary key,
    `key` varchar(64) not null,
    `value` varchar(512) not null,
    `topic` varchar(64) not null,
    `partition` int not null,
    `offset` int not null
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8;