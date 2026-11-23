package ar.global.odonto.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@ConfigurationPropertiesScan(basePackageClasses = AppProperties.class)
public class PropertiesConfig {
}
